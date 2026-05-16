/**
 * Cloudflare Email Worker for Zentaro.pk
 * 
 * Deploy this in your NEW Cloudflare account (separate from AhsanAutos).
 * 
 * 1. Forwards incoming email to your personal Gmail (backup)
 * 2. Sends raw email to Zentaro backend API for admin panel
 */

export default {
    async email(message, env, ctx) {
        // --- CONFIGURATION ---
        const FORWARD_TO_GMAIL = "your-backup@gmail.com"; // Change this!
        const PARSER_URL = "https://mail.zentaro.pk/api/email/incoming";
        const SECRET = "ZentaroEmailSecret2026!";

        // 1. Forward to Gmail backup
        try {
            await message.forward(FORWARD_TO_GMAIL);
        } catch (e) {
            console.error("Failed to forward to Gmail:", e);
        }

        // 2. Send to backend admin panel
        try {
            const rawEmail = await new Response(message.raw).text();

            const response = await fetch(PARSER_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    secret: SECRET,
                    from: message.from,
                    to: message.to,
                    raw: rawEmail
                }),
            });

            if (!response.ok) {
                console.error("Backend failed:", await response.text());
            }
        } catch (e) {
            console.error("Worker error:", e);
        }
    }
}
