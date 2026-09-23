import type { Product } from "@contract";
import type { DemoScenario, ResponseView } from "@/types/ui";
// Illustrative UI fixtures only. No search, ranking, file parsing or agent logic.
export const demoProduct: Product = {
  id: 515291,
  name: "Legrand DRX250 MT",
  article: "200300285_",
  supplierArticle: "027228",
  brand: "Legrand",
  price: 64920,
  quantity: 23,
  image: null,
  description: "Демонстрациялық карточка / Демонстрационная карточка.",
  properties: {
    Полюс: "3P",
    Ток: "160 A",
    "Үзу қабілеті": "18 kA",
    Кернеу: "400 V",
  },
  stores: [
    { id: 1, name: "Алматы", quantity: 5 },
    { id: 2, name: "Нур-Султан", quantity: 8 },
    { id: 3, name: "Атырау", quantity: 3 },
    { id: 4, name: "Қарағанды", quantity: 2 },
    { id: 5, name: "Тараз", quantity: 2 },
    { id: 6, name: "Орал", quantity: 0 },
  ],
};
const alternative: Product = {
  ...demoProduct,
  id: 515292,
  name: "Legrand DRX250 · үлгі B",
  article: "DEMO-B",
  supplierArticle: null,
  price: 71200,
  quantity: 7,
  properties: { ...demoProduct.properties, "Үзу қабілеті": "25 kA" },
  stores: [{ id: 1, name: "Алматы", quantity: 7 }],
};
export async function demoReply(
  scenario: DemoScenario,
  confirmed = false,
): Promise<ResponseView> {
  await new Promise((resolve) => setTimeout(resolve, 450));
  if (scenario === "error") throw new Error("Demo: backend unavailable.");
  if (confirmed)
    return {
      message:
        "Demo: растау қабылданды / подтверждение принято. Нақты корзина өзгермеді / реальная корзина не изменена.",
      cart: { success: true, cartUrl: null },
      messageId: crypto.randomUUID(),
    };
  const fixtures: Record<Exclude<DemoScenario, "error">, ResponseView> = {
    product: {
      message:
        "Demo · Legrand DRX250 MT. Тауар деректері төменде / данные товара ниже.",
      products: [demoProduct],
    },
    stock: {
      message:
        "Demo · Қоймалар бойынша қалдық / остатки по складам. Жалпы қалдық пен қоймалар backend мәндері ретінде бөлек көрсетіледі.",
      products: [demoProduct],
      freshness: { cacheAgeSeconds: 300, stale: true },
    },
    analog: {
      message:
        "Demo · Ұсынылған аналог / предложенный аналог. Айырмашылықтарды тексеріңіз / проверьте различия.",
      analogs: [
        {
          product: alternative,
          reasons: ["3 полюс", "160 A", "Legrand", "DRX250"],
          differences: ["18 kA → 25 kA"],
        },
      ],
    },
    cart: {
      message:
        "Demo · 2 дана қосу үшін растау қажет / для добавления 2 шт. нужно подтверждение.",
      products: [demoProduct],
      pendingAction: {
        type: "ADD_TO_CART",
        productId: demoProduct.id,
        quantity: 2,
      },
    },
    estimate: {
      message:
        "Demo · Алдын ала дайындалған үлгі / заранее подготовленный пример. Файл мазмұны оқылмайды / содержимое файла не анализируется.",
      estimate: {
        rows: [
          {
            requestText: "Legrand 160A, 3P",
            product: demoProduct,
            status: "found",
            quantity: 2,
            unitPrice: 64920,
            subtotal: 129840,
          },
          {
            requestText: "Балама автомат / аналог",
            product: alternative,
            status: "analog",
            quantity: 1,
            unitPrice: 71200,
            subtotal: 71200,
          },
          {
            requestText: "Кабель / кабель",
            status: "not_found",
            quantity: 10,
            unitPrice: null,
            subtotal: null,
          },
        ],
        total: 201040,
      },
    },
    compare: {
      message: "Demo · Салыстыру / сравнение предоставленных полей.",
      comparison: [demoProduct, alternative],
    },
    warning: {
      message: "Demo · Каталогтағы сәйкессіздік / расхождение в каталоге.",
      products: [
        {
          ...demoProduct,
          dataQualityWarnings: [
            {
              field: "current",
              message:
                "Атау/сипаттамада 160A, ал properties ішінде 250A көрсетілген.",
              sources: { description: "160A", properties: "250A" },
            },
          ],
          properties: { ...demoProduct.properties, Ток: "250 A" },
        },
      ],
    },
    missing: {
      message: "Demo · Толық емес деректер / неполные данные.",
      products: [
        {
          id: 9,
          name: "Деректері толық емес тауар / товар с неполными данными",
          article: null,
          price: null,
          image: null,
        },
      ],
    },
  };
  return { ...fixtures[scenario], messageId: crypto.randomUUID() };
}
