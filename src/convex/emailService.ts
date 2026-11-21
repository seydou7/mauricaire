import axios from "axios";

export interface SendEmailArgs {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Pluggable Email Service for MauriCare.
 * Separates business OTP/reset/verification logic from the concrete transport layer.
 */
export async function sendEmail({ to, subject, text, html }: SendEmailArgs): Promise<boolean> {
  const isDev = process.env.DEV_AUTH === "true" || process.env.NODE_ENV !== "production";
  const apiKey = process.env.VLY_API_KEY;

  if (isDev) {
    console.log(`[MauriCare Email Service] -> ${to} | Subject: "${subject}"\n${text}`);
  }

  // If a real delivery key is configured, send via VLY or configured mail gateway
  if (apiKey && apiKey !== "your_production_api_key") {
    try {
      await axios.post(
        "https://email.vly.ai/send_email",
        {
          to,
          subject,
          text,
          html,
          appName: process.env.VLY_APP_NAME || "MauriCare",
        },
        {
          headers: {
            "x-api-key": apiKey,
          },
          timeout: 8000,
        }
      );
      return true;
    } catch (err: any) {
      console.warn("[MauriCare Email Service] Failed to send remote email:", err?.message || err);
      if (!isDev) {
        throw new Error("Échec de l'envoi de l'e-mail.");
      }
    }
  }

  return true;
}

/**
 * Generate bilingual FR/AR email verification message
 */
export function getEmailVerificationTemplate(code: string, recipientName?: string) {
  const nameGreeting = recipientName ? ` ${recipientName}` : "";
  const subject = `MauriCare — Votre code de confirmation : ${code} | رمز التحقق`;
  const text = `Bonjour${nameGreeting},\n\n` +
    `Votre code de vérification MauriCare est : ${code}\n\n` +
    `Ce code est valable pendant 10 minutes. Ne le partagez avec personne.\n\n` +
    `---\n` +
    `مرحباً،\n` +
    `رمز التحقق الخاص بك في موريكير هو: ${code}\n` +
    `هذا الرمز صالح لمدة 10 دقائق. يُرجى عدم مشاركته مع أي شخص.\n\n` +
    `L'équipe MauriCare\nفريق موريكير`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #0f766e; margin: 0; font-size: 24px; font-weight: 700;">MauriCare | موريكير</h1>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Soins de santé à domicile en Mauritanie</p>
      </div>
      <div style="background: #f8fafc; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px;">
        <p style="color: #334155; font-size: 15px; margin: 0 0 12px 0;">Votre code de vérification :</p>
        <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0f766e; font-family: monospace;">${code}</div>
        <p style="color: #64748b; font-size: 13px; margin: 12px 0 0 0;">Valable pendant 10 minutes | صالح لمدة 10 دقائق</p>
      </div>
      <div style="direction: rtl; text-align: right; margin-top: 16px; border-top: 1px solid #f1f5f9; padding-top: 16px; color: #475569; font-size: 14px;">
        رمز التحقق الخاص بك لتفعيل حسابك في موريكير هو: <strong style="color: #0f766e;">${code}</strong>.
      </div>
    </div>
  `;

  return { subject, text, html };
}

/**
 * Generate bilingual FR/AR password reset message
 */
export function getPasswordResetTemplate(code: string, recipientName?: string) {
  const nameGreeting = recipientName ? ` ${recipientName}` : "";
  const subject = `MauriCare — Réinitialisation de votre mot de passe : ${code} | إعادة تعيين كلمة المرور`;
  const text = `Bonjour${nameGreeting},\n\n` +
    `Une demande de réinitialisation de mot de passe a été reçue pour votre compte MauriCare.\n\n` +
    `Votre code de sécurité est : ${code}\n\n` +
    `Ce code expire dans 10 minutes. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité.\n\n` +
    `---\n` +
    `مرحباً،\n` +
    `تم طلب إعادة تعيين كلمة المرور لحسابك في موريكير.\n` +
    `رمز الأمان الخاص بك هو: ${code}\n` +
    `هذا الرمز صالح لمدة 10 دقائق.\n\n` +
    `L'équipe MauriCare\nفريق موريكير`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #0f766e; margin: 0; font-size: 24px; font-weight: 700;">MauriCare | موريكير</h1>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Réinitialisation de mot de passe</p>
      </div>
      <div style="background: #f8fafc; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px;">
        <p style="color: #334155; font-size: 15px; margin: 0 0 12px 0;">Votre code de réinitialisation :</p>
        <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #b45309; font-family: monospace;">${code}</div>
        <p style="color: #64748b; font-size: 13px; margin: 12px 0 0 0;">Valable pendant 10 minutes | صالح لمدة 10 دقائق</p>
      </div>
      <div style="direction: rtl; text-align: right; margin-top: 16px; border-top: 1px solid #f1f5f9; padding-top: 16px; color: #475569; font-size: 14px;">
        رمز إعادة تعيين كلمة المرور هو: <strong style="color: #b45309;">${code}</strong>.
      </div>
    </div>
  `;

  return { subject, text, html };
}

/**
 * Generate bilingual FR/AR dossier submitted confirmation
 */
export function getDossierSubmittedTemplate(recipientName?: string) {
  const nameGreeting = recipientName ? ` ${recipientName}` : "";
  const subject = `MauriCare — Dossier d'inscription reçu | تم استلام ملف التسجيل`;
  const text = `Bonjour${nameGreeting},\n\n` +
    `Votre dossier d'inscription professionnelle a bien été reçu par l'équipe MauriCare.\n` +
    `Il est actuellement en cours d'instruction par nos équipes. Vous serez notifié dès qu'une décision sera prise.\n\n` +
    `---\n` +
    `مرحباً،\n` +
    `تم استلام ملف تسجيلك المهني بنجاح في موريكير، وهو قيد المراجعة حالياً.\n\n` +
    `L'équipe MauriCare | فريق موريكير`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <h2 style="color: #0f766e; margin: 0 0 16px 0;">Dossier d'inscription en cours d'examen</h2>
      <p style="color: #334155; font-size: 14px; line-height: 1.6;">Bonjour${nameGreeting}, votre dossier a été transmis avec succès. Notre équipe examine vos justificatifs afin de garantir la confiance de nos patients.</p>
      <div style="direction: rtl; text-align: right; margin-top: 16px; border-top: 1px solid #f1f5f9; padding-top: 16px; color: #475569; font-size: 14px;">
        تم استلام ملفك المهني بنجاح، ويتم فحصه حالياً من قبل فريق موريكير.
      </div>
    </div>
  `;
  return { subject, text, html };
}

/**
 * Generate bilingual FR/AR complement required notification
 */
export function getComplementRequiredTemplate(recipientName?: string, reasons: string[] = [], comment?: string) {
  const nameGreeting = recipientName ? ` ${recipientName}` : "";
  const subject = `MauriCare — Complément d'information requis pour votre dossier | مطلوب استكمال بيانات الملف`;
  const reasonsList = reasons.length > 0 ? `\nÉléments à compléter :\n- ${reasons.join("\n- ")}` : "";
  const commentText = comment ? `\n\nPrécisions de l'administration :\n"${comment}"` : "";

  const text = `Bonjour${nameGreeting},\n\n` +
    `Votre dossier d'accréditation professionnelle nécessite un complément d'information.${reasonsList}${commentText}\n\n` +
    `Veuillez vous connecter à votre espace MauriCare pour mettre à jour vos pièces justificatives.\n\n` +
    `---\n` +
    `مرحباً،\n` +
    `يتطلب ملف اعتمادك المهني في موريكير معلومات إضافية.\n\n` +
    `L'équipe MauriCare | فريق موريكير`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #fde68a; border-radius: 12px; background: #fffbeb;">
      <h2 style="color: #b45309; margin: 0 0 16px 0;">Complément de dossier requis</h2>
      <p style="color: #334155; font-size: 14px; line-height: 1.6;">Bonjour${nameGreeting}, des pièces ou précisions complémentaires sont nécessaires pour finaliser l'examen de votre profil.</p>
      ${reasons.length > 0 ? `<ul style="color: #475569; font-size: 13px;">${reasons.map((r) => `<li>${r}</li>`).join("")}</ul>` : ""}
      ${comment ? `<p style="color: #78350f; font-style: italic; font-size: 13px;">« ${comment} »</p>` : ""}
      <div style="direction: rtl; text-align: right; margin-top: 16px; border-top: 1px solid #fef3c7; padding-top: 16px; color: #92400e; font-size: 14px;">
        يرجى تسجيل الدخول إلى حسابك لتحديث المستندات المطلوبة.
      </div>
    </div>
  `;
  return { subject, text, html };
}

/**
 * Generate bilingual FR/AR dossier approved notification
 */
export function getDossierApprovedTemplate(recipientName?: string) {
  const nameGreeting = recipientName ? ` ${recipientName}` : "";
  const subject = `MauriCare — Félicitations ! Votre profil soignant a été validé | تهانينا، تم اعتماد ملفك`;
  const text = `Bonjour${nameGreeting},\n\n` +
    `Nous avons le plaisir de vous informer que votre dossier professionnel a été approuvé avec succès par l'équipe MauriCare.\n` +
    `Votre profil est désormais visible auprès des patients et vous pouvez commencer à recevoir des demandes de rendez-vous.\n\n` +
    `---\n` +
    `مرحباً،\n` +
    `يسرنا إبلاغك بأنه تمت الموافقة على ملفك المهني بنجاح في موريكير.\n` +
    `ملفك الشخصي متاح الآن للمرضى ويمكنك استقبال طلبات المواعيد.\n\n` +
    `L'équipe MauriCare | فريق موريكير`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #bbf7d0; border-radius: 12px; background: #f0fdf4;">
      <h2 style="color: #166534; margin: 0 0 16px 0;">Profil professionnel validé</h2>
      <p style="color: #334155; font-size: 14px; line-height: 1.6;">Bonjour${nameGreeting}, vos diplômes et pièces d'identité ont été vérifiés. Votre compte soignant est désormais pleinement actif.</p>
      <div style="direction: rtl; text-align: right; margin-top: 16px; border-top: 1px solid #dcfce7; padding-top: 16px; color: #15803d; font-size: 14px;">
        تم اعتماد حسابك المهني بنجاح، يمكنك الآن البدء في تقديم الرعاية للمرضى.
      </div>
    </div>
  `;
  return { subject, text, html };
}

/**
 * Generate bilingual FR/AR dossier rejected notification
 */
export function getDossierRejectedTemplate(recipientName?: string, reason?: string) {
  const nameGreeting = recipientName ? ` ${recipientName}` : "";
  const subject = `MauriCare — Décision concernant votre candidature | إشعار بخصوص طلب الانضمام`;
  const reasonText = reason ? `\nMotif de la décision : ${reason}` : "";

  const text = `Bonjour${nameGreeting},\n\n` +
    `Après examen minutieux de vos pièces justificatives, nous avons le regret de vous informer que votre dossier d'inscription soignant ne peut pas être validé.${reasonText}\n\n` +
    `Pour toute question ou contestation, vous pouvez contacter notre assistance.\n\n` +
    `---\n` +
    `مرحباً،\n` +
    `نأسف لإبلاغك بأنه تعذر قبول طلب اعتمادك المهني في الوقت الحالي.\n\n` +
    `L'équipe MauriCare | فريق موريكير`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #fecaca; border-radius: 12px; background: #fef2f2;">
      <h2 style="color: #991b1b; margin: 0 0 16px 0;">Dossier d'inscription non validé</h2>
      <p style="color: #334155; font-size: 14px; line-height: 1.6;">Bonjour${nameGreeting}, après examen de votre dossier, les critères de validation requis n'ont pas pu être vérifiés.</p>
      ${reason ? `<p style="color: #7f1d1d; font-size: 13px;"><strong>Motif :</strong> ${reason}</p>` : ""}
      <div style="direction: rtl; text-align: right; margin-top: 16px; border-top: 1px solid #fee2e2; padding-top: 16px; color: #b91c1c; font-size: 14px;">
        نعتذر عن عدم إمكانية اعتماد الملف في الوقت الحالي.
      </div>
    </div>
  `;
  return { subject, text, html };
}

/**
 * Email change OTP verification template
 */
export function getEmailChangeOtpTemplate(code: string, recipientName?: string) {
  const nameGreeting = recipientName ? ` ${recipientName}` : "";
  const subject = `MauriCare — Confirmation de votre nouvelle adresse email : ${code} | تأكيد البريد الإلكتروني`;
  const text = `Bonjour${nameGreeting},\n\n` +
    `Vous avez demandé à associer cette adresse e-mail à votre compte MauriCare.\n` +
    `Votre code de confirmation est : ${code}\n\n` +
    `Ce code expire dans 10 minutes.\n\n` +
    `---\n` +
    `مرحباً،\n` +
    `رمز تأكيد بريدك الإلكتروني الجديد في موريكير هو: ${code}\n\n` +
    `L'équipe MauriCare | فريق موريكير`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #0f766e; margin: 0; font-size: 24px; font-weight: 700;">MauriCare | موريكير</h1>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Changement d'adresse e-mail | تغيير البريد الإلكتروني</p>
      </div>
      <div style="background: #f8fafc; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px;">
        <p style="color: #334155; font-size: 15px; margin: 0 0 12px 0;">Votre code de confirmation :</p>
        <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0f766e; font-family: monospace;">${code}</div>
        <p style="color: #64748b; font-size: 13px; margin: 12px 0 0 0;">Valable 10 minutes | صالح لمدة 10 دقائق</p>
      </div>
      <div style="direction: rtl; text-align: right; margin-top: 16px; border-top: 1px solid #f1f5f9; padding-top: 16px; color: #475569; font-size: 14px;">
        رمز التحقق لتأكيد عنوان بريدك الجديد في موريكير هو: <strong style="color: #0f766e;">${code}</strong>.
      </div>
    </div>
  `;
  return { subject, text, html };
}

/**
 * Notification sent to old email address when email change is completed
 */
export function getEmailChangedNotificationTemplate(recipientName?: string, newEmail?: string) {
  const nameGreeting = recipientName ? ` ${recipientName}` : "";
  const subject = `MauriCare — Alerte de sécurité : Votre adresse email a été modifiée | تنبيه أمني`;
  const text = `Bonjour${nameGreeting},\n\n` +
    `L'adresse e-mail associée à votre compte MauriCare a été modifiée avec succès vers : ${newEmail || "une nouvelle adresse"}.\n` +
    `Si vous n'êtes pas à l'origine de cette modification, veuillez contacter immédiatement l'assistance MauriCare.\n\n` +
    `---\n` +
    `مرحباً،\n` +
    `تم تغيير البريد الإلكتروني المرتبط بحسابك في موريكير بنجاح.\n` +
    `إذا لم تكن أنت من قام بهذا التعديل، يُرجى التواصل فوراً مع الدعم الفني لموريكير.\n\n` +
    `L'équipe MauriCare | فريق موريكير`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #fde68a; border-radius: 12px; background: #fffbeb;">
      <h2 style="color: #b45309; margin: 0 0 12px 0;">Alerte de sécurité du compte</h2>
      <p style="color: #334155; font-size: 14px; line-height: 1.6;">Bonjour${nameGreeting}, l'adresse e-mail de votre compte MauriCare a été mise à jour vers <strong>${newEmail || "une nouvelle adresse"}</strong>.</p>
      <div style="direction: rtl; text-align: right; margin-top: 16px; border-top: 1px solid #fef3c7; padding-top: 16px; color: #92400e; font-size: 14px;">
        تم تحديث عنوان البريد الإلكتروني لحسابك في موريكير بنجاح.
      </div>
    </div>
  `;
  return { subject, text, html };
}

/**
 * Circle Invitation Email Template (Module 5)
 * Sent when a patient invites a trusted person to coordinate their healthcare.
 */
export function getCircleInvitationTemplate({
  patientName,
  relationship,
  permissions,
  inviteUrl,
}: {
  patientName: string;
  relationship: string;
  permissions: string[];
  inviteUrl: string;
}) {
  const subject = `MauriCare — ${patientName} vous invite à rejoindre son Cercle de proches | دعوة للانضمام إلى دائرة الرعاية`;
  
  const permListText = permissions.map((p) => `- ${p}`).join("\n");
  const text = `Bonjour,\n\n` +
    `${patientName} souhaite vous ajouter à son Cercle MauriCare en tant que ${relationship}.\n\n` +
    `Dans ce cadre, les autorisations suivantes vous sont confiées :\n` +
    `${permListText}\n\n` +
    `Pour examiner et accepter cette invitation en toute sécurité, cliquez sur le lien suivant :\n` +
    `${inviteUrl}\n\n` +
    `Ce lien est strictement confidentiel et expire dans 7 jours.\n\n` +
    `---\n` +
    `مرحباً،\n` +
    `يدعوك ${patientName} للانضمام إلى دائرة الرعاية الخاصة به في موريكير كـ (${relationship}).\n` +
    `لقبول الدعوة ومعاينة الصلاحيات الممنوحة، اضغط على الرابط أعلاه.\n\n` +
    `L'équipe MauriCare | فريق موريكير`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #0f766e; margin: 0; font-size: 24px; font-weight: 700;">MauriCare Circle | دائرة موريكير</h1>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Coordination & accompagnement familial des soins</p>
      </div>
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 18px; margin-bottom: 20px;">
        <p style="color: #166534; font-size: 15px; margin: 0 0 8px 0; font-weight: 600;">
          ${patientName} vous a invité(e) en tant que <em>${relationship}</em>.
        </p>
        <p style="color: #15803d; font-size: 13px; margin: 0;">
          Cette invitation vous permettra de l'aider à coordonner ses soins à domicile tout en respectant sa vie privée médicale.
        </p>
      </div>
      <div style="margin-bottom: 20px;">
        <p style="color: #334155; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">Autorisations proposées :</p>
        <ul style="color: #475569; font-size: 13px; line-height: 1.6; margin: 0; padding-left: 20px;">
          ${permissions.map((p) => `<li>${p}</li>`).join("")}
        </ul>
      </div>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${inviteUrl}" style="background: #0f766e; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">
          Examiner et accepter l'invitation
        </a>
      </div>
      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0 0 16px 0;">
        Ce lien expire dans 7 jours. Si vous n'avez pas encore de compte MauriCare, vous pourrez en créer un gratuitement.
      </p>
      <div style="direction: rtl; text-align: right; margin-top: 16px; border-top: 1px solid #f1f5f9; padding-top: 16px; color: #475569; font-size: 13px;">
        تمت دعوتك من طرف ${patientName} للانضمام إلى دائرته في موريكير.
      </div>
    </div>
  `;

  return { subject, text, html };
}
