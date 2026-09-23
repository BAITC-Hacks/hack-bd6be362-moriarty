import { EktAgent } from "../src/index.ts";
import { createDemoBackend } from "./demo-backend.ts";

const { tools } = createDemoBackend();
const agent = new EktAgent({ tools });
console.log("DEMO ONLY — synthetic fixtures; no real EKT or cart requests.\n");
for (const text of ["027228", "Алматыда бар ма?", "10 дана керек", "2 дана керек", "Иә, қос."]) {
  const reply = await agent.chat({ sessionId: "demo-kz", text });
  console.log(`User: ${text}\nAgent: ${reply.message}\n`);
}
for (const text of ["027228", "Какая цена?", "Нужно 2 штуки", "Да, добавь."]) {
  const reply = await agent.chat({ sessionId: "demo-ru", text, language: "ru" });
  console.log(`User: ${text}\nAgent: ${reply.message}\n`);
}
