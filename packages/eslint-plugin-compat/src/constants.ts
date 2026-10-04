// Keyed by the browser ids browserslist returns (the caniuse agent ids), plus node
export interface TargetNameMappings {
  chrome: "Chrome";
  firefox: "Firefox";
  safari: "Safari";
  ios_saf: "iOS Safari";
  ie: "IE";
  ie_mob: "IE Mobile";
  edge: "Edge";
  baidu: "Baidu";
  bb: "Blackberry Browser";
  and_uc: "Android UC Browser";
  and_chr: "Android Chrome";
  and_ff: "Android Firefox";
  and_qq: "QQ Browser";
  android: "Android Browser";
  samsung: "Samsung Browser";
  opera: "Opera";
  op_mini: "Opera Mini";
  op_mob: "Opera Mobile";
  node: "Node.js";
  kaios: "KaiOS";
}

// Maps an ID to the full name user will see
// E.g. during error, user will see full name instead of ID
export const STANDARD_TARGET_NAME_MAPPING: Readonly<TargetNameMappings> = {
  chrome: "Chrome",
  firefox: "Firefox",
  safari: "Safari",
  ios_saf: "iOS Safari",
  ie: "IE",
  ie_mob: "IE Mobile",
  edge: "Edge",
  baidu: "Baidu",
  bb: "Blackberry Browser",
  and_uc: "Android UC Browser",
  and_chr: "Android Chrome",
  and_ff: "Android Firefox",
  and_qq: "QQ Browser",
  android: "Android Browser",
  samsung: "Samsung Browser",
  opera: "Opera",
  op_mini: "Opera Mini",
  op_mob: "Opera Mobile",
  node: "Node.js",
  kaios: "KaiOS",
};

export enum AstNodeTypes {
  MemberExpression = "MemberExpression",
  CallExpression = "CallExpression",
  NewExpression = "NewExpression",
  Literal = "Literal",
}
