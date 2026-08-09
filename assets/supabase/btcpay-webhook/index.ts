// supabase/functions/btcpay-webhook/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, btcpay-sig",
};

// ==========================================
// 🚀 FIX: Helper function to prevent infinite hanging
// ==========================================
async function fetchWithTimeout(resource: string, options: RequestInit & { timeout?: number } = {}) {
  const { timeout = 10000 } = options; // 10 seconds default timeout
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error(`Request to ${resource} timed out after ${timeout}ms. Check if BTCPay URL is correct and online.`);
    }
    throw error;
  }
}

// 1. Timing-Safe Signature Verification
async function verifyBtcpaySignature(req: Request, rawBody: string): Promise<boolean> {
  const signatureHeader = req.headers.get("btcpay-sig");
  const webhookSecret = Deno.env.get("BTCPAY_WEBHOOK_SECRET") || Deno.env.get("BTCPAY_WEBHOOK");

  if (!webhookSecret) {
    console.error("CRITICAL: Webhook secret is missing in environment variables.");
    return false;
  }
  if (!signatureHeader) return false;

  try {
    const parts = signatureHeader.split("=");
    const providedSig = parts[1] || parts[0];

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
    const computedSig = Array.from(new Uint8Array(mac))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const a = encoder.encode(computedSig);
    const b = encoder.encode(providedSig);

    if (a.length !== b.length) return false;

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }

    return result === 0;
  } catch (e) {
    console.error("Signature verification exception:", e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const rawBodyText = await req.text();
    let body: any = {};
    if (rawBodyText) {
      try {
        body = JSON.parse(rawBodyText);
      } catch (_e) {}
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ==================================
    // 1. BTCPAY WEBHOOK (Server to Server)
    // ==================================
    if (body.type && body.invoiceId) {
      const isValidSig = await verifyBtcpaySignature(req, rawBodyText);
      if (!isValidSig) {
        return new Response(JSON.stringify({ error: "Unauthorized: Invalid or missing webhook signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const invoiceId = body.invoiceId;
      const eventType = body.type;
      console.log("Verified BTCPay Event:", eventType, "Invoice ID:", invoiceId);

      // Save EVERY webhook event to our Audit Table
      const { error: webhookLogError } = await supabase.from("webhook_events").insert({
        invoice_id: invoiceId,
        event_type: eventType,
        payload: body
      });

      if (webhookLogError) {
        console.error("Webhook log insert failed:", webhookLogError);
      }

      let newStatus = "pending";
      let shouldCredit = false;
      let shouldClear = false;

      if (eventType === "InvoiceSettled" || eventType === "InvoicePaidInFull") {
        newStatus = "paid";
        shouldCredit = true;
      } else if (eventType === "InvoiceExpired" || eventType === "InvoiceInvalid") {
        newStatus = "expired";
        shouldClear = true;
      }

      if (newStatus !== "pending") {
        const { data: updatedRows, error: updateErr } = await supabase
          .from("payments")
          .update({
            status: newStatus,
            paid_at: newStatus === "paid" ? new Date().toISOString() : null,
          })
          .eq("invoice_id", invoiceId)
          .eq("status", "pending")
          .select();

        if (updateErr) throw updateErr;

        if (!updatedRows || updatedRows.length === 0) {
          return new Response(JSON.stringify({ received: true, ignored: true }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const payment = updatedRows[0];

        if (shouldCredit) {
          const { error: rpcError } = await supabase.rpc("credit_model_payment", {
            target_model: payment.model_id, payment_amount: payment.amount,
          });
          if (rpcError) throw rpcError;
        } else if (shouldClear) {
          const { error: rpcError } = await supabase.rpc("clear_pending_payment", {
            target_model: payment.model_id, payment_amount: payment.amount,
          });
          if (rpcError) throw rpcError;
        }
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================================
    // 2. CREATE INVOICE (Frontend Request)
    // ==================================
    if (body.action === "create_invoice") {
      // Clean trailing slashes from BTCPay URL just in case
      let btcpayUrl = Deno.env.get("BTCPAY_URL") || "";
      if (btcpayUrl.endsWith("/")) btcpayUrl = btcpayUrl.slice(0, -1);
      
      const storeId = Deno.env.get("BTCPAY_STORE_ID");
      const token = Deno.env.get("BTCPAY_API_KEY");

      if (!btcpayUrl || !storeId || !token) {
        throw new Error("Missing BTCPay environment variables");
      }

      const amount = Number(body.amount);
      if (Number.isNaN(amount) || amount < 2 || amount > 2000) {
        throw new Error("Amount outside allowed range ($2 - $2000)");
      }

      const modelId = body.modelId;
      if (!modelId) throw new Error("Missing modelId");

      const { data: model, error: modelErr } = await supabase
        .from("models")
        .select("*")
        .eq("id", modelId)
        .single();

      if (modelErr || !model) throw new Error("Model not found in DB");

      // 🚀 FIX: Using fetchWithTimeout to prevent hanging
      const invoiceResponse = await fetchWithTimeout(`${btcpayUrl}/api/v1/stores/${storeId}/invoices`, {
        method: "POST",
        headers: {
          Authorization: `token ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          currency: "USD",
          checkout: {
            speedPolicy: "HighSpeed",
            lazyPaymentMethods: false,
            paymentMethods: ["BTC-LN", "BTC-CHAIN", "BTC-LNURL"]
          },
          metadata: { modelId, ownerId: model.owner_id, slug: model.slug },
        }),
      });

      if (!invoiceResponse.ok) {
        const errText = await invoiceResponse.text();
        throw new Error(`BTCPay API Error [${invoiceResponse.status}]: ${errText}`);
      }

      const invoice = await invoiceResponse.json();
      if (!invoice?.id) throw new Error("BTCPay invoice id missing");

      // 🚀 FIX: Using fetchWithTimeout here as well
      const pmRes = await fetchWithTimeout(`${btcpayUrl}/api/v1/stores/${storeId}/invoices/${invoice.id}/payment-methods`, {
        headers: { Authorization: `token ${token}` }
      });

      if (!pmRes.ok) throw new Error("Failed to load BTCPay payment methods endpoint");

      const methods = await pmRes.json();
      if (!methods || methods.length === 0) throw new Error("No payment methods returned by BTCPay. Check store configuration.");

      let selectedMethod = methods.find((p: any) => p.paymentMethod === "BTC-LN" || p.paymentMethod?.toLowerCase().includes("lightning"));
      if (!selectedMethod) selectedMethod = methods[0];

      const destination = selectedMethod?.destination;
      const paymentLink = selectedMethod?.paymentLink;

      if (!destination) throw new Error(`Failed to extract destination from /payment-methods for ${selectedMethod?.paymentMethod}`);

      const { error: paymentError } = await supabase.from("payments").insert({
        model_id: model.id,
        owner_id: model.owner_id,
        model_slug: model.slug,
        invoice_id: invoice.id,
        amount,
        currency: "USD",
        status: "pending",
        payment_method: selectedMethod.paymentMethod || "lightning",
      });

      if (paymentError) throw paymentError;

      const { error: rpcError } = await supabase.rpc("increment_pending_payment", {
        target_model: model.id, payment_amount: amount,
      });

      if (rpcError) throw rpcError;

      return new Response(
        JSON.stringify({
          invoiceId: invoice.id,
          paymentMethod: selectedMethod.paymentMethod,
          lightningCode: destination,
          btcAddress: destination,
          paymentLink: paymentLink,
          checkoutLink: invoice.checkoutLink
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================================
    // 3. CHECK STATUS (Frontend Polling)
    // ==================================
    if (body.checkStatus && body.invoiceId) {
      let btcpayUrl = Deno.env.get("BTCPAY_URL") || "";
      if (btcpayUrl.endsWith("/")) btcpayUrl = btcpayUrl.slice(0, -1);
      const storeId = Deno.env.get("BTCPAY_STORE_ID");
      const token = Deno.env.get("BTCPAY_API_KEY");

      // 🚀 FIX: Using fetchWithTimeout
      const response = await fetchWithTimeout(`${btcpayUrl}/api/v1/stores/${storeId}/invoices/${body.invoiceId}`, {
        headers: { Authorization: `token ${token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch invoice status");

      const invoice = await response.json();
      return new Response(JSON.stringify({
        invoiceId: invoice.id,
        status: invoice.status,
        amount: invoice.amount,
        currency: invoice.currency,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid request action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Edge Function Error:", err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
