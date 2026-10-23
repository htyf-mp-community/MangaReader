# MangaReader JSON 漫画源 v1

JSON 漫画源负责声明身份、能力、请求模板和解析规则。协议不会执行任意
JavaScript；复杂签名、解密和图片解扰只能引用随应用审核发布的 `builtin`
扩展。

## 基础字段

- `version`: 当前固定为 `1`。
- `id`: 全局唯一且稳定的源标识，收藏和阅读记录使用它关联漫画源。
- `engine`: `declarative` 或 `builtin`。
- `capabilities`: `search`、`discovery`、`detail`、`chapters`、`images` 的组合。
- `rules`: 声明式规则；禁止 `js`、`javascript` 和 `script` 字段。

## 规则语法

- HTML：`CSS选择器@text`、`CSS选择器@href`、`CSS选择器@html`。
- JSON：`$.items[*]`、`$.data.list[0].name`。
- 模板：`{{keyword}}`、`{{page}}`、`{{mangaId}}`、`{{chapterId}}`。
- 转换管道：`trim`、`url`、`lower`、`upper`、`regex:<表达式>`、
  `regexGroups:<表达式>::<连接符>`、`prefix:<文本>`、`suffix:<文本>`、
  `replace:<原文>=><新文>`、`date`。
- HTML 多值字段：在选择器末尾加 `[]`，例如 `.tag[]@text|trim`。
- 列表默认状态：`defaults.status` 可为 `unknown`、`serial` 或 `end`。

示例：`a.cover@href|trim|url`。

## 内置源迁移状态

插件管理列表以运行时 `PluginMap` 中已加载的源为准，默认源与外部导入源统一
展示（包括已禁用项）。缓存只提供排序和开关偏好，不决定成员；同 id 导入覆盖
当前实现和元数据，移除内置注册后旧缓存不会重新补回该源。目前仍保留 14 个默认源。

14 个原有漫画源现已全部由 `src/source-rules/sources.json` 决定注册顺序和
展示元数据。第一版保留原 TypeScript 实现作为 `builtin` 扩展，以确保签名、
解密、分页、Cookie、图片请求头及图片解扰行为不倒退。声明式请求会继承内置
源的默认请求头，再由 JSON 中的请求头覆盖。

用户可以在漫画源管理页粘贴单个对象或数组进行导入。导入源会写入同一专属
MMKV 命名空间并立即注册，无需重启。声明式执行器已支持搜索、发现、详情、
目录和章节图片；源必须为实际使用的能力提供相应规则，且用户源不能引用
`builtin`。

BZM 的搜索、发现、详情、目录、章节图片和多页加载已全部切换为 JSON 规则
实际执行；NH 的发现页也已切换。其余复杂源继续通过清单引用内置扩展，后续可
逐阶段迁移。远程订阅、可视化编辑、批量导出和源调试界面留待后续版本。
