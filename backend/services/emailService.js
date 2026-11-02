const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

// Create Nodemailer transport using environment variables
const createTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass }
    });
  }

  // Fallback / Development mode when SMTP is not configured
  return null;
};

const transporter = createTransporter();

/**
 * Generate responsive HTML template for Email OTP verification
 * @param {string} otp 
 * @param {string} recipientName 
 * @returns {string} HTML string
 */
const getOtpEmailTemplate = (otp, recipientName = 'User') => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your MELT Account</title>
    <style>
      body { margin: 0; padding: 0; background-color: #0B0D12; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F8FAFC; }
      .container { max-width: 560px; margin: 40px auto; background-color: #11151F; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; overflow: hidden; }
      .header { padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
      .logo { font-size: 26px; font-weight: 900; color: #FFFFFF; letter-spacing: -0.5px; }
      .logo span { color: #35D6B5; }
      .content { padding: 32px; }
      .title { font-size: 20px; font-weight: 700; color: #F8FAFC; margin-bottom: 12px; }
      .text { font-size: 14px; line-height: 1.6; color: #929BAD; margin-bottom: 24px; }
      .otp-box { background-color: #171D29; border: 1px solid rgba(128, 103, 247, 0.3); border-radius: 12px; padding: 20px; text-align: center; margin: 28px 0; }
      .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #35D6B5; font-family: monospace; }
      .expiry-badge { display: inline-block; font-size: 12px; font-weight: 600; color: #8067F7; background: rgba(128, 103, 247, 0.12); padding: 4px 12px; border-radius: 9999px; margin-top: 10px; }
      .warning { font-size: 12px; color: #64748B; border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: 20px; margin-top: 28px; }
      .footer { background-color: #0E1119; padding: 20px 32px; text-align: center; font-size: 11px; color: #64748B; border-top: 1px solid rgba(255, 255, 255, 0.04); }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="logo">MELT<span>.</span></div>
      </div>
      <div class="content">
        <div class="title">Verify Your Email Address</div>
        <p class="text">Hello ${recipientName}, welcome to MELT! Use the 6-digit verification code below to activate your encrypted real-time communications account.</p>
        
        <div class="otp-box">
          <div class="otp-code">${otp}</div>
          <div class="expiry-badge">⏱ Valid for 5 minutes</div>
        </div>

        <p class="text">Enter this code on the verification screen to complete your registration. For your security, never share this code with anyone.</p>
        
        <div class="warning">
          If you did not request this registration, please safely ignore this email. No account will be activated without this verification code.
        </div>
      </div>
      <div class="footer">
        &copy; ${new Date().getFullYear()} MELT Real-Time Platform. Stay connected. Share moments. Keep conversations flowing.
      </div>
    </div>
  </body>
  </html>
  `;
};

/**
 * Generate responsive HTML template for Password Reset
 * @param {string} resetLink 
 * @param {string} recipientName 
 * @returns {string} HTML string
 */
const getPasswordResetTemplate = (resetLink, recipientName = 'User') => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your MELT Password</title>
    <style>
      body { margin: 0; padding: 0; background-color: #0B0D12; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F8FAFC; }
      .container { max-width: 560px; margin: 40px auto; background-color: #11151F; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; overflow: hidden; }
      .header { padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
      .logo { font-size: 26px; font-weight: 900; color: #FFFFFF; letter-spacing: -0.5px; }
      .logo span { color: #35D6B5; }
      .content { padding: 32px; }
      .title { font-size: 20px; font-weight: 700; color: #F8FAFC; margin-bottom: 12px; }
      .text { font-size: 14px; line-height: 1.6; color: #929BAD; margin-bottom: 24px; }
      .btn-container { text-align: center; margin: 32px 0; }
      .btn { display: inline-block; background-color: #8067F7; color: #FFFFFF; text-decoration: none; font-size: 14px; font-weight: 600; padding: 14px 32px; border-radius: 12px; box-shadow: 0 0 20px rgba(128, 103, 247, 0.35); }
      .link-text { font-size: 12px; color: #64748B; word-break: break-all; margin-top: 16px; }
      .warning { font-size: 12px; color: #64748B; border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: 20px; margin-top: 28px; }
      .footer { background-color: #0E1119; padding: 20px 32px; text-align: center; font-size: 11px; color: #64748B; border-top: 1px solid rgba(255, 255, 255, 0.04); }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="logo">MELT<span>.</span></div>
      </div>
      <div class="content">
        <div class="title">Password Reset Request</div>
        <p class="text">Hello ${recipientName}, we received a request to reset the password for your MELT account. Click the button below to choose a new password:</p>
        
        <div class="btn-container">
          <a href="${resetLink}" class="btn" target="_blank">Reset My Password</a>
          <p class="link-text">Or copy this link:<br>${resetLink}</p>
        </div>

        <p class="text">This password reset link is valid for <strong>15 minutes</strong>. If you did not initiate this request, your account is still secure and no changes have been made.</p>
        
        <div class="warning">
          Security reminder: MELT will never ask for your password via email or chat.
        </div>
      </div>
      <div class="footer">
        &copy; ${new Date().getFullYear()} MELT Real-Time Platform. Stay connected. Share moments. Keep conversations flowing.
      </div>
    </div>
  </body>
  </html>
  `;
};

/**
 * Send 6-Digit Email Verification OTP
 * @param {string} email 
 * @param {string} otp 
 * @param {string} recipientName 
 */
const sendVerificationEmail = async (email, otp, recipientName = 'User') => {
  const from = process.env.EMAIL_FROM || '"MELT" <no-reply@melt.internal>';
  const subject = `${otp} is your MELT verification code`;
  const html = getOtpEmailTemplate(otp, recipientName);

  if (transporter) {
    try {
      const info = await transporter.sendMail({ from, to: email, subject, html });
      console.log(`[Email] OTP email successfully sent via SMTP to ${email} (MessageId: ${info.messageId})`);
      return { delivered: true, method: 'smtp' };
    } catch (error) {
      console.error(`[Email] Error sending email via SMTP to ${email}:`, error);
      // Fallback log for development transparency
      console.log(`[Email-Dev-Fallback] 🔑 OTP for ${email}: [ ${otp} ] (Expires in 5 min)`);
      return { delivered: false, error: error.message };
    }
  } else {
    // Development mode log when SMTP credentials are not yet configured
    console.log('------------------------------------------------------------');
    console.log(`✉️  [MELT Email Service - Dev Standby]`);
    console.log(`   To: ${email}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   🔑 6-Digit Verification OTP: [ ${otp} ]`);
    console.log(`   ⏱ Valid for: 5 minutes`);
    console.log(`   ℹ️ Note: Live SMTP delivery requires SMTP_HOST & SMTP_USER in .env`);
    console.log('------------------------------------------------------------');
    return { delivered: true, method: 'dev-console', otp };
  }
};

/**
 * Send Password Reset Email Link
 * @param {string} email 
 * @param {string} token 
 * @param {string} recipientName 
 */
const sendPasswordResetEmail = async (email, token, recipientName = 'User') => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = `${frontendUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
  const from = process.env.EMAIL_FROM || '"MELT" <no-reply@melt.internal>';
  const subject = `Reset your MELT account password`;
  const html = getPasswordResetTemplate(resetLink, recipientName);

  if (transporter) {
    try {
      const info = await transporter.sendMail({ from, to: email, subject, html });
      console.log(`[Email] Password reset email sent to ${email} (MessageId: ${info.messageId})`);
      return { delivered: true, method: 'smtp' };
    } catch (error) {
      console.error(`[Email] Error sending password reset via SMTP:`, error);
      console.log(`[Email-Dev-Fallback] 🔗 Reset link for ${email}: ${resetLink}`);
      return { delivered: false, error: error.message };
    }
  } else {
    console.log('------------------------------------------------------------');
    console.log(`✉️  [MELT Email Service - Dev Standby]`);
    console.log(`   To: ${email}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   🔗 Password Reset Link: ${resetLink}`);
    console.log(`   ⏱ Valid for: 15 minutes`);
    console.log('------------------------------------------------------------');
    return { delivered: true, method: 'dev-console', resetLink };
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail
};

