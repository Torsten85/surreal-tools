import Surreal from "surrealdb";
import { loadConfig } from "./config";

export default async function createSurreal() {
  const surreal = new Surreal();
  const config = await loadConfig();

  await surreal.connect(config.url, {
    authentication: config.authentication,
  });

  return surreal;
}
