import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const locales = ['ar','de','es','fa','fr','he','hi','id','it','ja','ko','nl','pl','pt-BR','ru','th','tr','uk','vi','zh-CN'];

const newKeys = {
  'integrations.cacheTitle': {
    ar:'ذاكرة التخزين المؤقت للإثراء',de:'Anreicherungs-Cache',es:'Caché de enriquecimiento',fa:'حافظه موقت غنی‌سازی',fr:'Cache d\'enrichissement',he:'מטמון העשרה',hi:'समृद्धि कैश',id:'Cache pengayaan',it:'Cache di arricchimento',ja:'エンリッチメントキャッシュ',ko:'강화 캐시',nl:'Verrijkingscache',pl:'Pamięć podręczna wzbogacania','pt-BR':'Cache de enriquecimento',ru:'Кэш обогащения',th:'แคชการเสริมข้อมูล',tr:'Zenginleştirme Önbelleği',uk:'Кеш збагачення',vi:'Bộ nhớ đệm làm phong phú','zh-CN':'富化缓存',
  },
  'integrations.cacheDesc': {
    ar:'يتم تخزين نتائج إثراء IOC الناجحة محليًا حتى لا تصل عمليات البحث المتكررة إلى واجهات برمجة التطبيقات ذات معدل الاستخدام المحدود.',de:'Erfolgreiche IOC-Anreicherungsergebnisse werden lokal gespeichert, damit wiederholte Abfragen nicht auf ratenbegrenzte APIs treffen.',es:'Los resultados exitosos de enriquecimiento de IOC se almacenan localmente para que las búsquedas repetidas no vuelvan a acceder a APIs con límite de velocidad.',fa:'نتایج موفق غنی‌سازی IOC به صورت محلی ذخیره می‌شوند تا جستجوهای تکراری به APIهای محدود شده نرخ دوباره دسترسی نداشته باشند.',fr:'Les résultats d\'enrichissement IOC réussis sont stockés localement afin que les recherches répétées n\'atteignent pas les API à débit limité.',he:'תוצאות הסמכה מוצלחות מאוחסנות מקומית כדי שחיפושים חוזרים לא יגיעו לממשקי API עם הגבלת קצב.',hi:'सफल IOC एनरिचमेंट परिणाम स्थानीय रूप से संग्रहीत किए जाते हैं ताकि बार-बार की जाने वाली खोजें दर-सीमित API को फिर से न चलाएं।',id:'Hasil pengayaan IOC yang berhasil disimpan secara lokal sehingga pencarian berulang tidak perlu mengakses API yang dibatasi kecepatan lagi.',it:'I risultati di arricchimento IOC riusciti vengono memorizzati localmente in modo che le ricerche ripetute non raggiungano nuovamente le API a frequenza limitata.',ja:'IOC エンリッチメントの成功結果はローカルに保存されるため、繰り返し検索でもレート制限された API に再度アクセスする必要がありません。',ko:'성공적인 IOC 강화 결과는 로컬에 저장되어 반복 조회 시 속도 제한된 API에 다시 접근하지 않습니다.',nl:'Succesvolle IOC-verrijkingsresultaten worden lokaal opgeslagen zodat herhaalde opzoekingen geen snelheidsbegrensde API\'s opnieuw hoeven te benaderen.',pl:'Pomyślne wyniki wzbogacania IOC są przechowywane lokalnie, aby ponowne wyszukiwania nie musiały ponownie uderzać w API z ograniczeniem szybkości.','pt-BR':'Resultados bem-sucedidos de enriquecimento de IOC são armazenados localmente para que pesquisas repetidas não precisem acessar APIs com limite de taxa novamente.',ru:'Успешные результаты обогащения IOC хранятся локально, чтобы повторные запросы не обращались к API с ограничением частоты.',th:'ผลลัพธ์การเสริมข้อมูล IOC ที่สำเร็จจะถูกเก็บไว้ในเครื่อง เพื่อไม่ให้การค้นหาซ้ำๆ เข้าถึง API ที่มีการจำกัดอัตราอีกครั้ง',tr:'Başarılı IOC zenginleştirme sonuçları yerel olarak depolanır, böylece tekrarlanan aramalar hız sınırlı API\'lere tekrar ulaşmaz.',uk:'Успішні результати збагачення IOC зберігаються локально, щоб повторні запити не зверталися до API з обмеженням частоти.',vi:'Kết quả làm phong phú IOC thành công được lưu trữ cục bộ để các tra cứu lặp lại không cần truy cập lại API bị giới hạn tốc độ.','zh-CN':'成功的IOC富化结果在本地存储，避免重复查询再次触达有速率限制的API。',
  },
  'integrations.cacheTtl': {
    ar:'مدة الصلاحية',de:'Cache-TTL',es:'TTL de caché',fa:'مدت اعتبار کش',fr:'TTL du cache',he:'TTL מטמון',hi:'कैश TTL',id:'TTL cache',it:'TTL cache',ja:'キャッシュTTL',ko:'캐시 TTL',nl:'Cache-TTL',pl:'TTL pamięci podręcznej','pt-BR':'TTL do cache',ru:'TTL кэша',th:'TTL ของแคช',tr:'Önbellek TTL',uk:'TTL кешу',vi:'TTL bộ nhớ đệm','zh-CN':'缓存TTL',
  },
  'integrations.cacheTtlValue': {
    ar:'{{hours}}س',de:'{{hours}}Std.',es:'{{hours}}h',fa:'{{hours}}ساعت',fr:'{{hours}}h',he:'{{hours}}ש',hi:'{{hours}}घं',id:'{{hours}}j',it:'{{hours}}h',ja:'{{hours}}時間',ko:'{{hours}}시간',nl:'{{hours}}u',pl:'{{hours}}g','pt-BR':'{{hours}}h',ru:'{{hours}}ч',th:'{{hours}}ชม.',tr:'{{hours}}sa',uk:'{{hours}}г',vi:'{{hours}}giờ','zh-CN':'{{hours}}小时',
  },
  'integrations.cacheDisabled': {
    ar:'معطّل',de:'Deaktiviert',es:'Desactivado',fa:'غیرفعال',fr:'Désactivé',he:'מושבת',hi:'अक्षम',id:'Dinonaktifkan',it:'Disabilitato',ja:'無効',ko:'비활성화됨',nl:'Uitgeschakeld',pl:'Wyłączone','pt-BR':'Desativado',ru:'Отключено',th:'ปิดใช้งาน',tr:'Devre dışı',uk:'Вимкнено',vi:'Vô hiệu hóa','zh-CN':'已禁用',
  },
};

for (const locale of locales) {
  const filePath = resolve(root, 'public', 'locales', locale, 'settings.json');
  try {
    const obj = JSON.parse(readFileSync(filePath, 'utf8'));
    let added = 0;
    for (const [k, vals] of Object.entries(newKeys)) {
      if (!obj[k]) { obj[k] = vals[locale] ?? vals['de']; added++; }
    }
    writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
    console.log(`${locale}: +${added}`);
  } catch (e) {
    console.error(`${locale}: ERROR ${e.message}`);
  }
}
console.log('Done');
