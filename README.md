# Creator Management & Payout Dashboard

A secure, serverless, and multi-tenant web application designed for content creators to track their earnings, manage payment links, and request withdrawals. The system includes a comprehensive Master Admin panel for global revenue tracking and payout management.

## 🚀 Features

### For Creators (Users)
*   **Secure Authentication:** Powered by Supabase Auth (Email & Password).
*   **Auto-Assigned Links:** Unique payment links are automatically generated and assigned upon registration.
*   **Real-time Analytics:** Track Total Earned, Available Balance, and Pending Payments.
*   **Withdrawal System:** Seamlessly request payouts via multiple methods (Bank, Binance, Local Mobile Money).

### For Master Admin
*   **Global Dashboard:** View total settled amounts, pending withdrawals, and lifetime revenue.
*   **Profit Calculator:** Built-in dynamic calculator to manage exchange rates and calculate net profits.
*   **Payout Management:** Review and approve creator withdrawal requests with one click.
*   **Security:** Secure admin login that bypasses standard Row Level Security (RLS) safely.

## 🛠️ Tech Stack

*   **Frontend:** HTML5, Vanilla JavaScript, Custom CSS (Dark Premium UI)
*   **Backend as a Service (BaaS):** [Supabase](https://supabase.com/)
*   **Database:** PostgreSQL
*   **Security:** Strict Row Level Security (RLS) to ensure absolute data isolation between users.
*   **Hosting:** GitHub Pages

## 📂 Project Structure

*   `index.html` - Landing page / entry point.
*   `login.html` & `register.html` - Secure authentication pages.
*   `dashboard.html` - The main portal for creators.
*   `admin.html` - The restricted Master Admin panel.
*   `SECURITY.md` - Security policies and reporting guidelines.

## 🔒 Security Notice

This project utilizes **Row Level Security (RLS)** in PostgreSQL. Ensure that proper RLS policies are enabled in your Supabase dashboard so that authenticated users can only `SELECT`, `INSERT`, or `UPDATE` their own data. The Master Admin role is handled strictly via restricted database views and verified email policies.

---
*Designed & Developed for seamless creator management.*

