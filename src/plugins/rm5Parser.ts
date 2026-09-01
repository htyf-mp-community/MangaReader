/** 从 RM5 的 Next.js 脚本片段提取章节图片地址，并保持页面出现顺序。 */
export function extractScriptImageUrls(script: string): string[] {
  return script.match(/https?:\/\/[^\\"]+?\.(?:jpg|jpeg|png|webp|gif)/gi) || [];
}
