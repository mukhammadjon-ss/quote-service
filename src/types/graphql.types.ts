import { MercuriusContext } from "mercurius";
import { QuoteService } from "../services/quote.service";

export interface MyContext extends MercuriusContext {
  quoteService: QuoteService;
}
