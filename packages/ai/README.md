#  AI / Agent

Бұл модуль тек AI/Agent бөлігін орындайды. EKT HTTP клиенті, каталог индексі, backend HTTP route-тары және frontend осы модульге кірмейді. Оларды 1- және 3-адамдар `BackendTools`, `FileExtractor`, `ChatInput` интерфейстері арқылы қосады.

## Іске қосу

Жоба түбірінен, Node.js 24 немесе жаңарақ нұсқада:

```powershell
npm ci --ignore-scripts
npm run typecheck
npm test
npm run demo:ai
```

Runtime тәуелділік жоқ: Node TypeScript-ті тікелей орындайды. TypeScript компиляторы тек әзірлеу кезінде қолданылады. Тесттер `node:test` арқылы бір процесте орындалады.

`npm run demo:ai` пайдаланушы берген **11.txt каталог көшірмесін** қолданады: екі беттегі 40 тауар және бір detail. Желіге сұрау жіберілмейді; баға/қалдық файлдағы уақытқа тиесілі. Деректің қазіргі өзектілігі расталмаған. Қалған 39 тауардың қалдығы `null`, ал `160А`/`250 А` қайшылығы ескерту ретінде беріледі. [Дерек туралы](data/README.md).

Бұрынғы синтетикалық демо `npm run demo:synthetic` арқылы сақталған. Ондағы өнімдер **тесттік fixture**; `demo.invalid` — тесттік домен. Синтетикалық және файлдан келген каталогтар араластырылмайды.

Cart integration is mocked because cart API was not supplied in provided materials.

Бұл mock тек синтетикалық демода қолданылады. `11.txt` адаптері read-only: растаудан кейін де live қалдықты тексере алмайтындықтан, себетті өзгертпейді.

## 11.txt деректерін агентке қосу

Каталог `data/ekt-snapshot.json` ішіне импортталған. Бір рет жүктелген JSON-ды адаптерге беріңіз:

```ts
import { EktAgent, createSnapshotBackend } from "./packages/ai/src/index.ts";
import type { EktSnapshot } from "./packages/ai/src/index.ts";

export function fromImportedCatalog(snapshot: EktSnapshot) {
  const { tools } = createSnapshotBackend(snapshot);
  return new EktAgent({ tools });
}
```

`027228`, `200300285_`, `515291`, `3414970344526`, `RM17UAS16`, `Legrand 160A` бойынша іздеу бар. Құрылымды спецификацияда тек нақты ID/артикул/атау сәйкестіктері `found` болады. List-only өнімдерге stock, certificate немесе техникалық detail қосылмайды. Расталған аналог үшін жеткілікті detail/stock жоқ болса, adapter бос кандидаттар береді. Feedback бұл жергілікті адаптерде тек процесс жадында сақталады; тұрақты сақтау production backend-те қосылады.

Freshness contract-іне `source: "file"`, `sourceName`, `importedAt` қосылды. `importedAt` API жаңартылған уақыт ретінде көрсетілмейді. Қайта импорттау: `npm run import:catalog -- "C:\Users\akk77\OneDrive\Desktop\11.txt"`.

## Дайын мүмкіндіктер

- Каталогтан іздеу, detail, баға, жалпы және жеке қойма қалдығы.
- Сенімді артикул/ID сәйкестігін таңдау; белгісіз немесе бірнеше нәтиже болса, ең көбі үш нұсқадан таңдату.
- `selectedProductId`, `recentProductIds`, `originalProductId`, `lastSearch`, тіл, қойма және `pendingAction` контексті.
- Нөлдік қалдық кезінде қолжетімді аналогтарды тексеру; сәйкестіктерді, айырмашылықтарды, белгісіз өрістерді көрсету.
- Каталогтағы `dataQualityWarnings`, сертификаттың жоқтығы және ресми шарттардың қолжетімсіздігі туралы ашық жауап.
- Бір тауарға және спецификациядағы табылған тауарларға бөлек растау; жаңартылған баға/қалдық өзгерсе, қайта растау.
- Қазақша/орысша жауап, салыстыру, дерек көзі/жаңару уақыты, ескі кэш туралы ескерту.
- PDF/Excel және басқа файлдардан **сәтті шығарылған** жолдарды тексеріп, `matchSpecification` арқылы құрылымды есеп алу.
- Файлдағы нұсқауларды команда ретінде орындамау; тек `suspicious content in file` оқиғасын тіркеу, файл мәтінін логқа жазбау.
- `recordFeedback(messageId, rating)` — **quality signal for future improvement**; серверге жіберіледі, сессияда берілген messageId ғана қабылданады.

## Backend-ке қосу

Бір сервер экземпляры үшін агентті бір рет жасаңыз. HTTP сұранысы сайын жаңа агент жасау контексті жоғалтады.

```ts
import { EktAgent } from "./packages/ai/src/index.ts";
import type { BackendTools } from "./packages/ai/src/index.ts";

// Бұл объектіні 1-адам нақты сервер сервистері арқылы береді.
export function createAssistant(tools: BackendTools) {
  return new EktAgent({ tools });
}

// Сервер route-ында:
// await agent.chat({
//   sessionId: authenticatedSession.id,
//   text: request.body.text,
// });
```

`sessionId` клиент еркін таңдайтын бөтен ID болмауы керек: оны сервер авторизацияланған сессиядан алады. Бір tenant-та басқа пайдаланушының сессиясын ашуға жол бермеңіз. Жауаптағы `products` және `estimate` — frontend-ке арналған дерек; мәтін мен техникалық сипаттамаларды HTML ретінде орындамаңыз.

Толық типтер: [contracts.ts](src/contracts.ts), [ортақ Product/ChatResponse](../shared/types.ts).

Backend мына операцияларды іске асырады:

- `search_products(query, context)` → `{ items, exactMatchId?, fetchedAt?, source? }`. `exactMatchId` тек backend сенімді сәйкестік тапқанда беріледі; жалғыз әлсіз нәтиже өздігінен таңдалмайды.
- `get_product_detail(id, context)` → `Product`.
- `get_availability(id, context)` → `{ total, available, stores }`. Белгісіз қалдық — `null`, нөл емес. `fresh: true` болса, live деректі жаңарту қажет.
- `get_analog_candidates(id, context)` → `Product[]`. Agent кандидаттың detail/қалдығын қайта оқиды. Дәл сәйкестікке арналған ең аз өрістер: санат, кернеу, ток, полюстер, ажырату қабілеті; қосымша сала талаптарын backend кандидат іріктеуінде тексеріңіз.
- `get_purchase_terms(context)` → ресми `sourceUrl`, `approved: true` және берілген шарттар. Ресми дерек жоқ болса, `approved: false`.
- `matchSpecification(rows, context)` → кіріс жолдарымен бірдей реттіліктегі нәтижелер. `not_found` немесе `analog_suggested` жолы табылған тауар ретінде есептелмейді. `totalMissing` — табылмаған және аналог ұсынылған жолдардың жалпы саны. `grandTotal` тек `found` жолдарын қамтиды; баға жетіспесе `null` қолдануға болады.
- `recordFeedback(messageId, rating, context)` → backend логына/сақтау орнына жазу.

Құралдарға желілік timeout-ты, жауап схемаларын және EKT authentication-ды backend адаптерінде орнатыңыз. Құпиясөздер мен API кілттері сервер ортасында сақталады.

## LLM қосу

Әдепкіде модуль алдын ала белгіленген қазақша/орысша сұрау үлгілерін таниды. Бұл — API кілтінсіз іске қосылатын детерминистік режим, еркін тілдің барлық нұсқасын түсінетін LLM емес.

LLM қолдану үшін `JsonIntentPlanner`-ге команда таңдаған провайдердің JSON генерация функциясын беріңіз:

```ts
import { EktAgent, JsonIntentPlanner } from "./packages/ai/src/index.ts";
import type { BackendTools } from "./packages/ai/src/index.ts";

export function withModel(
  tools: BackendTools,
  generateJson: (input: { system: string; input: string; schema: unknown }) => Promise<unknown>,
) {
  return new EktAgent({ tools, planner: new JsonIntentPlanner(generateJson) });
}
```

`generateJson` провайдер нәтижесінен JSON объектісін немесе JSON мәтінін қайтарады. Adapter-ге timeout қойыңыз. План валидациядан өтпесе, жергілікті intent parser қолданылады. Модель жауабы intent пен read/query параметрлерін ғана анықтайды; соңғы баға/қалдық/жауап каталог деректерінен құрылады. Модель `confirmed=true` орната алмайды.

Жүйелік промпт: [prompt.ts](src/prompt.ts). JSON Schema: [schemas.ts](src/schemas.ts). `READ_TOOL_SCHEMAS` пен controller-ге ғана арналған `CONTROLLER_TOOL_SCHEMAS` бөлек экспортталған. Mutation құралдарын LLM-ге тікелей бермеңіз.

## Frontend contract және растау

`ChatResponse` негізгі өрістері: `messageId`, `intent`, `message`, `products`, `warnings`, `pendingAction`, `cart`. Қосымша: `estimate`, `analogs`, `freshness`, `error`.

```ts
// Тізімнен таңдау — тек осы сессияда көрсетілген ID:
await agent.chat({ sessionId, selectedProductId: 515291 });

// Ұсыныс; осы кезде себет өзгермейді:
const proposal = await agent.chat({ sessionId, text: "2 дана керек" });

// ConfirmationModal түймесі; actionId-ті соңғы ұсыныстан алыңыз:
await agent.chat({
  sessionId,
  confirmation: {
    actionId: proposal.pendingAction!.actionId,
    decision: "confirm", // немесе "cancel"
  },
});
```

`pendingAction.type` бір тауарда `ADD_TO_CART`, бірнеше тауарда `ADD_MANY_TO_CART`. Бір тауар үшін бұрынғы `productId`/`quantity` өрістері де бар. `items` массивінде бекітілген `unitPrice` және қойма таңдалса `storeId` беріледі. `total`, `actionId`, `expiresAt` модалда көрсетілетін ұсыныспен байланысты.

Мәтіндік «Иә», «Иә, қос», «Растаймын», «Да, добавь», «Подтверждаю» тек күтіп тұрған ұсыныс барда қабылданады. «2 дана керек», «возьму два», шартты не цитаталанған мәтіндер растау емес. Ұсыныс 5 минуттан кейін жарамсыз болады. Кез келген аралық жаңа сұрақ бұрынғы ұсынысты жояды. Мерзімді `confirmationTtlMs` арқылы өзгертуге болады.

Mutation алдында stock/price қайта тексеріледі; кэш жауабымен қосуға рұқсат жоқ. Қалдық азайса, қолжетімді санға жаңа ұсыныс жасалады. Backend-тің атомарлық тексеруі де міндетті: тек agent жағындағы read-check жарыс жағдайын толық жаппайды.

`add_to_cart` және `add_many_to_cart` adapter-лері:

1. `sessionId` бойынша нақты себетті анықтайды.
2. `idempotencyKey` арқылы бір әрекетті бір рет орындайды.
3. `expectedLines` бағасын, қоймасын және жеткілікті қалдықты mutation кезінде атомарлық тексереді.
4. Бірнеше тауарды **all-or-none** операциясымен қосады. Бірнеше single-item call-ды циклмен шақыру бұл contract-ке сай емес.
5. Нақты `success` және сервер берген `cartUrl` қайтарады. Реал себет API-і берілмесе, demo adapter `mocked: true` қайтарады.

Mutation жауабы жоғалса, нәтиже «белгісіз» болып қалады. Agent қайталап қоспайды: келесі сұрауда `get_cart_action_status(actionId)` шақырады. `succeeded` → расталған нәтиже; `not_applied` → жаңа ұсыныс жасауға болады; `unknown` → жаңа mutation әлі жабық. Backend `not_applied` тек бұрынғы операция кейін де орындалмайтыны анық болғанда қайтаруы керек.

`MemorySessionStore` бір процесс үшін сессияларды кезекпен орындайды, 30 минуттық TTL және 1000 сессиялық шектеуі бар. Мәртебесі белгісіз cart операциялары TTL кезінде жойылмайды. Бірнеше процесс/сервер және рестарттан кейінгі контекст үшін `SessionStore.withSession` интерфейсіне durable store + distributed lock адаптерін қосыңыз. In-memory demo restart кезінде контекст жоғалады.

## Файлдар және B2B есеп

Файл жүктеу, OCR және PDF/XLSX/DOCX binary parser-лері 3-адамның upload қабатында немесе серверлік `FileExtractor` адаптерінде орындалады. Agent extractor-ды шақыруды, шығарылған жолдарды тексеруді және есеп логикасын іске асырады. Нақты binary extractor бұл тапсырмаға берілмеген.

```ts
const agent = new EktAgent({ tools, extractor: yourFileExtractor });
await agent.chat({
  sessionId,
  text: "Мына спецификациядағы тауарларды тауып бер",
  attachments: [{ name: "spec.xlsx", mimeType: xlsxMimeType, bytes: uploadedBytes }],
});
```

Серверде бұрыннан шығарылған мәтін бар болса:

```ts
await agent.chat({
  sessionId,
  attachments: [{
    name: "spec.pdf", mimeType: "application/pdf",
    extracted: { success: true, rows: [
      { query: "027228", requestedQty: 2 },
      { query: "027229", requestedQty: 1 },
    ] },
  }],
});
```

`extracted` — тек серверлік интеграция өрісі; оны тексерусіз public request-тен алмаңыз. Мәтіннің өзі барлық жағдайда сенімсіз DATA. `FILE_PRODUCT_SEARCH` бір жол үшін search шақырады; бірнеше жол немесе Excel/PDF спецификация `matchSpecification` арқылы өңделеді.

UTF-8 text үшін жол пішімі: `027228;2` немесе `027228<TAB>2`. Сан берілмесе 1 алынады. Бұл қарапайым жол форматы; күрделі CSV кестесін extractor-да шығарыңыз. Шектеулер: сұрауға 5 файл, әрқайсысына 10 MiB, шығарылған мәтінге 100000 таңба, жалпы 200 жол, жолға 2000 таңба, оң бүтін сан. JPEG/PNG/PDF/XLS/XLSX/DOC/DOCX extractor арқылы қолдау табады; extractor жоқ болса, агент файлды оқыдым деп айтпайды.

`estimate.rows` табылған, табылмаған және аналог ұсынылған жолдарды сақтайды. Белгісіз баға толық grand total ретінде көрсетілмейді. Аналог бастапқы тауар анықталмаған кезде техникалық сәйкес деп жарияланбайды. Себет ұсынысына тек `found` жолдары өтеді; қайталанған өнім саны біріктіріліп, қалдықпен тексеріледі. Қосуға дейін бәрібір пайдаланушы растауы қажет.

## Қазақша/орысша мысалдар

Төмендегілер — `npm run demo:synthetic` fixture-дегі жауаптар:

```text
User: 027228
Agent: DEMO DRX250 ... Бағасы: 64 920 ₸. Қалдық: 23 дана.
User: Алматыда бар ма?
Agent: Алматы: 5 дана.
User: 2 дана керек
Agent: 2 × 64 920 ₸ = 129 840 ₸. Корзинаға қосайын ба?
User: Иә, қос.
Agent: Демо себет: Тауарлар корзинаға қосылды. [сервер берген сілтеме]

User: 027228
User: Какая цена?
Agent: Цена: 64 920 ₸.
User: Мне нужно 2
Agent: Итого: 129 840 ₸. Добавить в корзину?
User: Да, добавь.
Agent: Демо-корзина: Товары добавлены в корзину.
```

Автотесттер: [agent.test.mjs](test/agent.test.mjs). Іздеу, екі тіл, контекст, аналог айырмашылығы, data conflict, төлем/сертификат/шарттар, файл injection, спецификация есебі, feedback, session isolation, concurrent confirmation, price/stock change және timeout reconciliation тексеріледі.
