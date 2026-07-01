/**
 * Patches all locale settings.json files with the Slack outbound webhook keys.
 * Run: node scripts/patch-slack-outbound-i18n.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, '..', 'public', 'locales');

const TRANSLATIONS = {
  ar: {
    'general.slackOutbound': 'تنبيهات وكيل Slack',
    'general.slackOutboundDesc': 'رابط Webhook الوارد للوكلاء لنشر التنبيهات إلى قناة Slack. أنشئ واحدًا في مساحة عمل Slack الخاصة بك ضمن التطبيقات ← Incoming Webhooks.',
    'general.slackOutboundPlaceholder': 'https://hooks.slack.com/services/...',
  },
  de: {
    'general.slackOutbound': 'Slack-Agent-Benachrichtigungen',
    'general.slackOutboundDesc': 'Eingehende Webhook-URL für Agenten zum Posten von Warnungen in einem Slack-Kanal. Erstellen Sie eine in Ihrem Slack-Arbeitsbereich unter Apps → Incoming Webhooks.',
    'general.slackOutboundPlaceholder': 'https://hooks.slack.com/services/...',
  },
  es: {
    'general.slackOutbound': 'Alertas de agente de Slack',
    'general.slackOutboundDesc': 'URL de webhook entrante para que los agentes publiquen alertas en un canal de Slack. Crea uno en tu espacio de trabajo de Slack en Aplicaciones → Incoming Webhooks.',
    'general.slackOutboundPlaceholder': 'https://hooks.slack.com/services/...',
  },
  fa: {
    'general.slackOutbound': 'هشدارهای نماینده Slack',
    'general.slackOutboundDesc': 'آدرس Webhook ورودی برای ارسال هشدارها توسط عوامل به کانال Slack. یکی را در فضای کاری Slack خود زیر Apps → Incoming Webhooks ایجاد کنید.',
    'general.slackOutboundPlaceholder': 'https://hooks.slack.com/services/...',
  },
  fr: {
    'general.slackOutbound': "Alertes d'agent Slack",
    'general.slackOutboundDesc': "URL du webhook entrant pour que les agents publient des alertes sur un canal Slack. Créez-en un dans votre espace de travail Slack sous Applications → Incoming Webhooks.",
    'general.slackOutboundPlaceholder': 'https://hooks.slack.com/services/...',
  },
  he: {
    'general.slackOutbound': 'התראות סוכן Slack',
    'general.slackOutboundDesc': 'כתובת URL של Webhook נכנס לסוכנים לפרסום התראות בערוץ Slack. צור אחד במרחב העבודה שלך ב-Slack תחת אפליקציות ← Incoming Webhooks.',
    'general.slackOutboundPlaceholder': 'https://hooks.slack.com/services/...',
  },
  hi: {
    'general.slackOutbound': 'Slack एजेंट अलर्ट',
    'general.slackOutboundDesc': 'एजेंट के लिए Slack चैनल पर अलर्ट पोस्ट करने हेतु इनकमिंग Webhook URL। अपने Slack कार्यक्षेत्र में Apps → Incoming Webhooks के अंतर्गत एक बनाएं।',
    'general.slackOutboundPlaceholder': 'https://hooks.slack.com/services/...',
  },
  id: {
    'general.slackOutbound': 'Peringatan Agen Slack',
    'general.slackOutboundDesc': 'URL webhook masuk bagi agen untuk memposting peringatan ke saluran Slack. Buat satu di ruang kerja Slack Anda di bawah Apps → Incoming Webhooks.',
    'general.slackOutboundPlaceholder': 'https://hooks.slack.com/services/...',
  },
  it: {
    'general.slackOutbound': 'Avvisi agente Slack',
    'general.slackOutboundDesc': 'URL del webhook in entrata per consentire agli agenti di pubblicare avvisi su un canale Slack. Creane uno nel tuo spazio di lavoro Slack in App → Incoming Webhooks.',
    'general.slackOutboundPlaceholder': 'https://hooks.slack.com/services/...',
  },
  ja: {
    'general.slackOutbound': 'Slackエージェントアラート',
    'general.slackOutboundDesc': 'エージェントがSlackチャンネルにアラートを投稿するための受信Webhook URL。SlackワークスペースのApps → Incoming Webhooksで作成してください。',
    'general.slackOutboundPlaceholder': 'https://hooks.slack.com/services/...',
  },
  ko: {
    'general.slackOutbound': 'Slack 에이전트 알림',
    'general.slackOutboundDesc': '에이전트가 Slack 채널에 알림을 게시하기 위한 수신 Webhook URL. Slack 작업 공간의 앱 → Incoming Webhooks에서 생성하세요.',
    'general.slackOutboundPlaceholder': 'https://hooks.slack.com/services/...',
  },
  nl: {
    'general.slackOutbound': 'Slack-agentmeldingen',
    'general.slackOutboundDesc': 'Inkomende webhook-URL voor agenten om meldingen te plaatsen in een Slack-kanaal. Maak er een aan in uw Slack-werkruimte onder Apps → Incoming Webhooks.',
    'general.slackOutboundPlaceholder': 'https://hooks.slack.com/services/...',
  },
  pl: {
    'general.slackOutbound': 'Alerty agenta Slack',
    'general.slackOutboundDesc': 'Przychodzący adres URL webhooka dla agentów do publikowania alertów w kanale Slack. Utwórz go w obszarze roboczym Slack w sekcji Aplikacje → Przychodzące webhooki.',
    'general.slackOutboundPlaceholder': 'https://hooks.slack.com/services/...',
  },
  'pt-BR': {
    'general.slackOutbound': 'Alertas de agente do Slack',
    'general.slackOutboundDesc': 'URL de webhook de entrada para agentes postarem alertas em um canal do Slack. Crie um no seu espaço de trabalho do Slack em Aplicativos → Incoming Webhooks.',
    'general.slackOutboundPlaceholder': 'https://hooks.slack.com/services/...',
  },
  ru: {
    'general.slackOutbound': 'Оповещения агента Slack',
    'general.slackOutboundDesc': 'URL входящего веб-хука для публикации оповещений агентами в канале Slack. Создайте его в рабочем пространстве Slack в разделе Приложения → Входящие веб-хуки.',
    'general.slackOutboundPlaceholder': 'https://hooks.slack.com/services/...',
  },
  th: {
    'general.slackOutbound': 'การแจ้งเตือนตัวแทน Slack',
    'general.slackOutboundDesc': 'URL webhook ขาเข้าสำหรับตัวแทนในการโพสต์การแจ้งเตือนไปยังช่อง Slack สร้างอันหนึ่งในพื้นที่ทำงาน Slack ของคุณภายใต้ Apps → Incoming Webhooks',
    'general.slackOutboundPlaceholder': 'https://hooks.slack.com/services/...',
  },
  tr: {
    'general.slackOutbound': 'Slack Ajan Uyarıları',
    'general.slackOutboundDesc': 'Ajanların Slack kanalına uyarı göndermesi için gelen webhook URL\'si. Slack çalışma alanınızda Uygulamalar → Incoming Webhooks altında bir tane oluşturun.',
    'general.slackOutboundPlaceholder': 'https://hooks.slack.com/services/...',
  },
  uk: {
    'general.slackOutbound': 'Сповіщення агента Slack',
    'general.slackOutboundDesc': 'URL вхідного веб-хука для публікації сповіщень агентами в каналі Slack. Створіть його у робочому просторі Slack у розділі Програми → Вхідні веб-хуки.',
    'general.slackOutboundPlaceholder': 'https://hooks.slack.com/services/...',
  },
  vi: {
    'general.slackOutbound': 'Cảnh báo tác nhân Slack',
    'general.slackOutboundDesc': 'URL webhook đến để tác nhân đăng cảnh báo lên kênh Slack. Tạo một URL trong không gian làm việc Slack của bạn trong Apps → Incoming Webhooks.',
    'general.slackOutboundPlaceholder': 'https://hooks.slack.com/services/...',
  },
  'zh-CN': {
    'general.slackOutbound': 'Slack 智能体通知',
    'general.slackOutboundDesc': '用于智能体向 Slack 频道发布通知的传入 Webhook URL。在您的 Slack 工作区的应用 → Incoming Webhooks 下创建。',
    'general.slackOutboundPlaceholder': 'https://hooks.slack.com/services/...',
  },
};

const KEYS = ['general.slackOutbound', 'general.slackOutboundDesc', 'general.slackOutboundPlaceholder'];

for (const [locale, translations] of Object.entries(TRANSLATIONS)) {
  const filePath = join(localesDir, locale, 'settings.json');
  let data;
  try {
    data = JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (e) {
    console.error(`Could not read ${filePath}:`, e.message);
    continue;
  }

  let changed = false;
  for (const key of KEYS) {
    if (!data[key]) {
      data[key] = translations[key];
      changed = true;
    }
  }

  if (changed) {
    writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    console.log(`✓ Patched ${locale}/settings.json`);
  } else {
    console.log(`  ${locale}/settings.json already has all keys`);
  }
}

console.log('Done.');
