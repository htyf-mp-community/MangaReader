import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import type { ParsedRule } from './types';
import dayjs from 'dayjs';

// 同一响应里的列表项会被读取多个字段；按节点复用 Cheerio 上下文。
const htmlContexts = new WeakMap<AnyNode, ReturnType<typeof cheerio.load>>();
const htmlContext = (node: AnyNode | string) => {
  if (typeof node === 'string') return cheerio.load(node);
  let context = htmlContexts.get(node);
  if (!context) {
    context = cheerio.load(node);
    htmlContexts.set(node, context);
  }
  return context;
};

/** 将相对地址补全为绝对地址；无效输入保持原值，便于源调试定位。 */
export const resolveSourceUrl = (value: string, baseUrl: string): string => {
  const target = value.trim();
  // 缺失字段必须保持为空，否则末页会被误判为仍有下一页，广告也会变成图片。
  if (!target) return '';
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(target)) return target;
  const origin = baseUrl.match(/^([a-z][a-z\d+.-]*:\/\/[^/]+)/i)?.[1];
  if (!origin) return value;
  if (target.startsWith('//')) return `${baseUrl.split(':')[0]}:${target}`;
  if (target.startsWith('/')) return origin + target;
  const directory = baseUrl.replace(/[?#].*$/, '').replace(/\/[^/]*$/, '/');
  const segments = (directory + target).replace(origin, '').split('/');
  const normalized: string[] = [];
  segments.forEach((segment) => {
    if (!segment || segment === '.') return;
    if (segment === '..') normalized.pop();
    else normalized.push(segment);
  });
  return `${origin}/${normalized.join('/')}`;
};

/** 解析 `选择器@属性|转换|转换:参数` 格式，不支持执行任意 JavaScript。 */
export const parseRule = (rule: string): ParsedRule => {
  const [target = '', ...transforms] = rule.split('|').map((item) => item.trim());
  const attributeAt = target.lastIndexOf('@');
  return {
    selector: attributeAt < 0 ? target : target.slice(0, attributeAt),
    attribute: attributeAt < 0 ? undefined : target.slice(attributeAt + 1),
    transforms: transforms.filter(Boolean),
  };
};

const applyTransform = (value: string, transform: string, baseUrl: string): string => {
  const separator = transform.indexOf(':');
  const name = separator < 0 ? transform : transform.slice(0, separator);
  const argument = separator < 0 ? '' : transform.slice(separator + 1);
  if (name === 'trim') return value.trim();
  if (name === 'url') return resolveSourceUrl(value, baseUrl);
  if (name === 'lower') return value.toLowerCase();
  if (name === 'upper') return value.toUpperCase();
  if (name === 'prefix') return argument + value;
  if (name === 'suffix') return value + argument;
  if (name === 'date') {
    const full = value.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (full) return `${full[1]}-${full[2].padStart(2, '0')}-${full[3].padStart(2, '0')}`;
    const hours = value.match(/(\d+)小时前/);
    if (hours) return dayjs().subtract(Number(hours[1]), 'hour').format('YYYY-MM-DD');
    if (value.includes('今天')) return dayjs().format('YYYY-MM-DD');
    return value.trim();
  }
  if (name === 'replace') {
    const [from = '', to = ''] = argument.split('=>');
    return value.split(from).join(to);
  }
  if (name === 'regex') {
    const match = value.match(new RegExp(argument));
    return match?.[1] ?? match?.[0] ?? '';
  }
  if (name === 'regexGroups') {
    const splitAt = argument.lastIndexOf('::');
    const pattern = splitAt < 0 ? argument : argument.slice(0, splitAt);
    const joiner = splitAt < 0 ? '' : argument.slice(splitAt + 2);
    const match = value.match(new RegExp(pattern));
    return match ? match.slice(1).join(joiner) : '';
  }
  throw new Error(`不支持的漫画源转换：${name}`);
};

const transformValue = (value: string, transforms: string[], baseUrl: string) =>
  transforms.reduce((result, transform) => applyTransform(result, transform, baseUrl), value);

/** 从 HTML 节点执行 MangaReader CSS 规则。 */
export const readHtmlRule = (node: AnyNode | string, rule: string, baseUrl: string): string => {
  const parsed = parseRule(rule);
  const $ = htmlContext(node);
  const many = parsed.selector.endsWith('[]');
  const selector = many ? parsed.selector.slice(0, -2) : parsed.selector;
  const target = selector
    ? $(selector)
    : typeof node === 'string'
      ? $.root()
      : $(node).first();
  const read = (element: AnyNode) => {
    const selected = $(element);
    return !parsed.attribute || parsed.attribute === 'text'
      ? selected.text()
      : parsed.attribute === 'html'
        ? selected.html() ?? ''
        : selected.attr(parsed.attribute) ?? '';
  };
  const raw = many ? target.toArray().map(read).join(',') : target.first().toArray().map(read)[0] ?? '';
  return transformValue(raw, parsed.transforms, baseUrl);
};

/** 执行受限 JSONPath：支持 `$`、点路径、数组下标和 `[*]`。 */
export const readJsonPath = (input: unknown, path: string): unknown[] => {
  const tokens = path.replace(/^\$\.?/, '').match(/[^.[\]]+|\[(\d+|\*)\]/g) ?? [];
  return tokens.reduce<unknown[]>((values, token) => {
    const key = token.startsWith('[') ? token.slice(1, -1) : token;
    if (key === '*') return values.flatMap((value) => Array.isArray(value) ? value : []);
    return values.flatMap((value) => {
      if (value == null || typeof value !== 'object') return [];
      const next = (value as Record<string, unknown>)[key];
      return next === undefined ? [] : [next];
    });
  }, [input]);
};

/** 从 JSON 数据读取字段并应用与 HTML 相同的安全转换管道。 */
export const readJsonRule = (input: unknown, rule: string, baseUrl: string): string => {
  const [path = '', ...transforms] = rule.split('|').map((item) => item.trim());
  const value = readJsonPath(input, path)[0];
  return transformValue(value == null ? '' : String(value), transforms, baseUrl);
};

/** 替换请求模板中的白名单变量。 */
const templateValue = (value: string | number | undefined, fallback = '') =>
  value === undefined || value === '$$DEFAULT$$' ? fallback : String(value);

/** 替换请求体和请求头模板，保留原始字符供请求层编码一次。 */
export const renderSourceValueTemplate = (template: string, variables: Record<string, string | number>) =>
  template.replace(/\{\{\s*([a-zA-Z][\w]*)(?:\|default:([^}]*))?\s*\}\}/g, (_match, name: string, fallback?: string) =>
    templateValue(variables[name], fallback?.trim())
  );

export const renderSourceTemplate = (template: string, variables: Record<string, string | number>) =>
  template.replace(/\{\{\s*([a-zA-Z][\w]*)(?:\|default:([^}]*))?\s*\}\}/g, (_match, name: string, fallback?: string) =>
    encodeURIComponent(templateValue(variables[name], fallback?.trim()))
  );
