import { RuleTester } from "eslint";
import { describe, it } from "vitest";

// RuleTester only finds describe/it as globals; register Vitest's explicitly
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;
