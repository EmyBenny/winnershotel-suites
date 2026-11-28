import crypto from 'crypto';
import nodemailer from 'nodemailer';
import type { EmailLog, HotelProfile, Reservation } from '../src/types/hotel.ts';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatNgn(amount: number): string {
  return `₦${amount.toLocaleString('en-NG')}`;
}

export async function dispatchConfirmationEmail(
  reservation: Reservation,
  profile: HotelProfile
): Promise<EmailLog> {
  const subject = `Reservation Confirmed · ${profile.name} (${reservation.bookingRef})`;

  const bodyText = [
    `WINNERS HOTEL AND SUITES — ${profile.location.toUpperCase()}`,
    `Booking Reference: ${reservation.bookingRef}`,
    `Status: ${reservation.status.toUpperCase()} (${reservation.paymentStatus === 'paid' ? 'Paid in Full' : 'Guaranteed Hold'})`,
    '',
    `Dear ${reservation.guestName},`,
    `Thank you for reserving with Winners Hotel and Suites. Your suite is confirmed.`,
    '',
    `STAY DETAILS`,
    `Suite Category: ${reservation.roomName}${reservation.roomNumber ? ` (${reservation.roomNumber})` : ''}`,
    `Check-In: ${reservation.checkIn} (from ${profile.checkInTime})`,
    `Check-Out: ${reservation.checkOut} (by ${profile.checkOutTime})`,
    `Guests: ${reservation.guestsCount} · Nights: ${reservation.nights}`,
    `Airport Chauffeur Pickup: ${reservation.airportPickup ? 'Requested (Experienced Driver Assigned)' : 'Not requested'}`,
    '',
    `PAYMENT RECEIPT`,
    `Payment Reference: ${reservation.paymentRef}`,
    `Method: ${reservation.paymentMethod.replace(/_/g, ' ').toUpperCase()}`,
    `Room Subtotal: ${formatNgn(reservation.subtotalNgn)}`,
    `Hospitality & VAT (7.5%): ${formatNgn(reservation.serviceFeeNgn)}`,
    reservation.promoDiscountNgn > 0 ? `Seasonal Offer Discount: -${formatNgn(reservation.promoDiscountNgn)}` : '',
    reservation.loyaltyDiscountNgn > 0 ? `Winners Royal Club Points Redeemed: -${formatNgn(reservation.loyaltyDiscountNgn)}` : '',
    `Total Amount: ${formatNgn(reservation.totalPaidNgn)}`,
    `Loyalty Points Earned: +${reservation.pointsEarned} pts`,
    '',
    `CONCIERGE & ARRIVAL`,
    `Address: ${profile.address}`,
    `Call Us: ${profile.replyPhone || '+234 812 595 7751'} · ${profile.whatsappPhone || '+2349074489687'}`,
    `Email Us: ${profile.email || 'info@winnersgroupofcompany.com'} · ${profile.secondaryEmail || 'manager@winnersgroupofcompany.com'}`,
  ]
    .filter(Boolean)
    .join('\n');

  const bodyHtml = `
    <div style="font-family:'Plus Jakarta Sans',Arial,sans-serif;max-width:600px;margin:0 auto;background:#F8F9FA;color:#040037;border:1px solid #DEDDEB;">
      <div style="background:#040037;padding:28px 32px;color:#F8F9FA;border-bottom:4px solid #E21E51;">
        <p style="margin:0;font-size:12px;letter-spacing:0.14em;color:#FF85A5;text-transform:uppercase;">${escapeHtml(profile.address)}</p>
        <h1 style="margin:6px 0 0;font-family:Georgia,serif;font-size:26px;font-weight:600;color:#FFFFFF;">${escapeHtml(profile.name)}</h1>
      </div>
      <div style="padding:28px 32px;background:#FFFFFF;">
        <p style="margin:0 0 8px;font-size:13px;color:#514D7C;">Booking Reference</p>
        <p style="margin:0 0 20px;font-family:monospace;font-size:20px;font-weight:700;color:#040037;">${escapeHtml(reservation.bookingRef)}</p>
        <p style="margin:0 0 18px;font-size:15px;line-height:1.6;">Dear ${escapeHtml(reservation.guestName)}, your stay in ${escapeHtml(profile.location)} is confirmed (Free Breakfast included). Below is your official confirmation and payment receipt.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
          <tr><td style="padding:8px 0;border-bottom:1px solid #DEDDEB;color:#514D7C;">Suite</td><td style="padding:8px 0;border-bottom:1px solid #DEDDEB;text-align:right;font-weight:600;">${escapeHtml(reservation.roomName)}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #DEDDEB;color:#514D7C;">Check-In</td><td style="padding:8px 0;border-bottom:1px solid #DEDDEB;text-align:right;">${escapeHtml(reservation.checkIn)} · ${escapeHtml(profile.checkInTime)}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #DEDDEB;color:#514D7C;">Check-Out</td><td style="padding:8px 0;border-bottom:1px solid #DEDDEB;text-align:right;">${escapeHtml(reservation.checkOut)} · ${escapeHtml(profile.checkOutTime)}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #DEDDEB;color:#514D7C;">Payment Ref</td><td style="padding:8px 0;border-bottom:1px solid #DEDDEB;text-align:right;font-family:monospace;">${escapeHtml(reservation.paymentRef)}</td></tr>
          <tr><td style="padding:12px 0;font-weight:700;font-size:16px;">Total Paid</td><td style="padding:12px 0;text-align:right;font-weight:700;font-size:16px;color:#E21E51;">${escapeHtml(formatNgn(reservation.totalPaidNgn))}</td></tr>
        </table>
        <p style="margin:16px 0 0;font-size:13px;color:#514D7C;">Winners Royal Club Points Earned: <strong>+${reservation.pointsEarned} pts</strong></p>
        <p style="margin:12px 0 0;font-size:13px;color:#514D7C;">Call us on <strong>${escapeHtml(profile.replyPhone || '+234 812 595 7751')}</strong> or <strong>${escapeHtml(profile.whatsappPhone || '+2349074489687')}</strong> · Email: <strong>${escapeHtml(profile.email || 'info@winnersgroupofcompany.com')}</strong> / <strong>${escapeHtml(profile.secondaryEmail || 'manager@winnersgroupofcompany.com')}</strong>.</p>
      </div>
    </div>
  `.trim();

  let deliveryMode: 'smtp' | 'dispatch_log' = 'dispatch_log';

  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const port = Number(process.env.SMTP_PORT || '587');
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure: port === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM || profile.email,
        to: reservation.guestEmail,
        subject,
        text: bodyText,
        html: bodyHtml,
      });
      deliveryMode = 'smtp';
    } catch (err) {
      console.error('SMTP delivery failed, falling back to dispatch log:', err);
    }
  }

  return {
    id: `mail-${crypto.randomUUID().slice(0, 8)}`,
    bookingRef: reservation.bookingRef,
    toEmail: reservation.guestEmail,
    guestName: reservation.guestName,
    subject,
    bodyText,
    bodyHtml,
    deliveryMode,
    status: 'sent',
    sentAt: new Date().toISOString(),
  };
}
