# Pro 12个月优惠测试与 SKU 扫描

**只安装、开启一个 G1 ACQ**，即可被动采集原始 SKU 与 `offerIdToken`、执行 SKU 改写并查看本机报告；`v7.7.0` 继续提供最近 10 次响应、本次新增与重复诊断。脚本先从匹配 `one.google.com/` 的 URL、Location 与可扫描正文采集商品编号，再仅在 `/ai?` 响应中把 `g1.ios.2tb.` 前缀的 **原始 iOS 2TB 完整 SKU** 改为 `g1.2tb.ai.12months_ip_90p`，同时新增完整源 ID `g1.ios.ai.2tb.m.ip_1mo_90p.acq` → `g1.2tb.ai.12months_eft`（无 `.acq` 后缀），将 20TB 固定改为 `g1.2tb.ai.18months_eft`（无 `.acq` 后缀），30TB 固定改为 `g1.ai.ultra.1month_eft.acq`，均没有备用目标。原有 2TB 前缀与新增精确 2TB 源 ID 分别使用固定目标且没有备用档，完整映射见第 4 节；当前响应脚本版本为 `g1-acq-v7.7.0`。

采集器只读取手机实际收到的匹配响应，**不会主动查询全量 SKU**。旧 ID 再次出现会增加次数，但不会变成新增 ID；看到旧清单本身不足以判断手机脚本失效，本轮没有已验证的实机故障结论。

**原有 2TB 前缀映射的 12个月优惠测试完整候选为 `g1.2tb.ai.12months_ip_90p`，没有 `.acq` 后缀。** 用户截图首项提供该候选与价格标签 `$1.99 × 12 months = $23.88/year`，图示表达连续 12 个月的月度优惠；`90p` 表示 **90% off，约一折**，不是实付 90% 的九折。`$23.88/year` 是截图中的 12 个月合计标签，不是一次年付扣款的证据。

截图标题为 **Pro 5TB**，其对应的原有前缀映射源商品仍是 `g1.ios.2tb.` 前缀的原始 iOS 2TB 完整 SKU，没有新增 5TB 源前缀。截图是候选与价格标签的来源，不是已验证的 iOS 商店商品资料，也不证明实际 iOS 价格、扣款周期或 5TB 权益。操作环境是 iPhone 上的 Shadowrocket 与 Google App；候选名称、周期、初次与续费金额待 App Store 实际返回商品后核对，权益以 Google One 账户显示为准。离线测试验证字符串匹配与报告行为。

## 1. 安装或升级主模块

**G1 ACQ — 被动采集、SKU 改写、最近 10 次响应诊断与 JSON 导出**

```text
https://cdn.jsdelivr.net/gh/nhoxloxchoi11/g1-acq@v7.7.0/g1-acq-v7.sgmodule
```

首次安装时在小火箭模块管理中添加上面的地址并启用；从旧版本升级时，将旧 **G1 ACQ** 替换为此地址一次。模块名仍为 **G1 ACQ**，安装入口与全部内部脚本均固定引用 `@v7.7.0`，无需单独添加脚本。安装或升级后重新连接，再重新打开 Google App 的方案页。升级保留历史记录；重复安装不会促使服务器下发新 SKU，诊断时先比较版本、计数与响应时间。

采集和改写在同一个主模块中依次执行，无需另装或切换 **G1 SKU Scan**。只装了一个主模块时，没有额外关闭步骤；若曾安装独立扫描器、**G1 Pro Annual Test** 或其它改写副本，停用这些旧副本，避免重复计数或改写。历史 `v7.0.0` / `v7.1.0` / `v7.2.0` / `v7.3.0` / `v7.4.0`、`pro-annual-test-v1` / `pro-annual-test-v2` 标签保持不动。

本版响应活动诊断来自主脚本 `g1-acq-v7.7.0`。**G1 Pro Annual Test** 兼容入口引用同一新脚本，但仍仅匹配 `/ai?`；独立 **G1 SKU Scan** 也升级为 `g1-sku-scan-v7.7.0`，采集 SKU、命名 `offerIdToken` 与同对象关联，但不提供最近 10 次响应诊断。主模块已含采集功能，独立入口仅供不需改写时替代使用，不要与主模块同时启用。新版报告保留旧记录的实际版本，不补造 `recentResponses` 或旧记录缺失的 token。

主模块包含本地报告脚本，只追加 MITM hostname `one.google.com`，并沿用原有全局 UDP 443 拦截规则；后者也会影响其它 App 的 HTTP/3、速度或连通性。

## 2. 配置 HTTPS 解密

模块要处理 HTTPS 响应，需在当前使用的配置中启用解密并信任证书。

1. 启用第 1 节 `v7.7.0` 地址安装的 **G1 ACQ**，旧版用户按第 1 节升级一次，保持小火箭 VPN 连接。
2. 进入 **配置页 → 当前使用配置右侧的 (i) 图标 → HTTPS 解密**，打开解密开关。
3. 已有可用且已受信任的 Shadowrocket 证书时直接沿用；尚未配置证书时，在该页生成并安装证书，再前往 iOS **设置 → 通用 → VPN 与设备管理** 完成描述文件安装。
4. 首次配置证书时，前往 iOS **设置 → 通用 → 关于本机 → 证书信任设置**，开启对应 Shadowrocket 根证书的信任。
5. 在当前配置的 **HTTPS 解密 hostname 列表**中核对 `one.google.com`。模块使用 `%APPEND%` 追加该域名；此处是 HTTPS 解密列表，不是 DNS Hosts。
6. 更改模块开关或解密配置后重新连接小火箭，再重新进入 Google App 的方案页面。

[README 中的配置入口截图](../README.md#安装shadowrocket--小火箭)展示了当前配置右侧的 `(i)` 入口。MITM hostname 覆盖 `one.google.com` 整个域名，脚本读取与改写范围由下文的 URL 匹配限定。

## 3. 浏览方案，被动采集原始 SKU 与 offerIdToken

保持同一个 **G1 ACQ** 开启即可。每次处理 `one.google.com/` 的匹配响应时，主脚本先从请求 URL、响应 Location 与可扫描正文采集，再检查是否需要 SKU 改写，候选编号不会被本次后续改写替换。正文非文本或为跳过的二进制媒体时，仍可从 URL / Location 采集数据。

1. 保持小火箭连接，在同一手机 Safari 地址栏粘贴完整[本地报告地址](https://one.google.com/g1-sku-report)，核对 **本机脚本已接管** 与报告版本 **v7.7.0**；先记录实际 `scan.version`、`scannedResponses`、`matchedResponses`、`nonTextResponses` 和最新响应时间。
2. 打开 **Google App（彩色 G 图标）→ Google One 管理**，重新进入页面实际提供的 **2TB / Pro** 方案；核对其它映射时，再浏览实际提供的 **20TB / 30TB** 方案。
3. 页面提供月付、年付切换时，逐个浏览并等待加载完成。只有新收到的匹配响应才产生采集活动，无需完成购买；账号、地区、App 版本决定实际显示的方案与控件，页面缓存也会影响是否发出新请求。
4. 返回 Safari 刷新报告，对比计数和最新响应，查看本次新增数与状态。计数增长且 `known-skus` 表示重复数据；清单没有新增不等于采集停止。计数与最新响应时间均未变，只能确认本轮未保存新的采集记录；存储写入失败也会保留旧计数，按第 7 节核对 `saved=no` / `SKU collection unavailable` 日志、缓存、匹配范围与模块配置。
5. 查看“浏览页面时采集到的候选 SKU”，记录完整编号、次数、最近发现时间。寻找实际出现的 `g1.ios.2tb.` 前缀完整编号或新增精确源 ID `g1.ios.ai.2tb.m.ip_1mo_90p.acq`；20TB / 30TB 对照第 4 节的两个完整源 ID，不自行补全或猜测后缀。
6. 点报告操作区的 **导出 JSON** 按钮保存结果，也可直接打开 [JSON 导出地址](https://one.google.com/g1-sku-report?format=json)。

被动采集覆盖 `https://one.google.com/` 下的匹配响应，跳过 `/g1-sku-report`、末尾带 `/` 的同一路径及其 query。发现来源包括请求 URL、响应 `Location` 与受限正文；响应头名称不区分大小写。识别 `g1.`、`g1_`、`g1:`、`com.google.one.` 等形式，支持大小写并过滤常见脚本属性、资源扩展名与域名噪声。按 ID 保存观察次数，同一响应多次识别或后续再次出现都可能增加 SKU 次数，次数不是购买次数。

最多保留 **300 个不同 ID**。达到上限后继续更新已保存 ID 的次数和时间；超出上限的新 ID 不再加入列表，`omittedCount` 记录本次因容量丢弃的不同 ID 数。正文可扫描时，`addedCount>0` 优先标为 `new-skus`，即使同时存在容量丢弃；正文可扫描且 `addedCount=0`、`omittedCount>0` 时才标为 `limit-reached`。正文不可扫描时保留 `non-text` 状态，即使 URL / Location 的 SKU 计数大于零。保留旧清单即可比较新增与重复；只有明确要重置历史记录时，才在导出后手动执行第 5 节的两键清理，日常诊断无需清空。

采集在发现副本中还原百分号编码、`\xNN`、Unicode 转义与 HTML 实体；这个还原步骤不修改原响应，JSON 中的命名不透明 token 保留原值。每个正文最多扫描 **4,194,304 字符**；按 Content-Type 跳过图片、音频、视频、字体、PDF 与 Wasm 正文，仍可检查请求 URL 和响应 Location。采集完成后，仅匹配 `/ai?` 的响应进入 SKU 改写，其它响应原样返回。脚本不读取请求头或请求体，不保存完整响应正文，不查询 App Store，不向外发送采集数据。

### 3.1 收集 offerIdToken 与查找 Pro 12个月 EFT 文本候选

主模块 `g1-acq-v7.7.0` 和独立扫描器 `g1-sku-scan-v7.7.0` 都收集实际请求 URL、响应 Location 与受限正文中的命名 offer token。支持 `offerIdToken`、`offerToken` 及支持的下划线、连字符别名，可来自有边界的 JSON、嵌套 JSON 字符串、HTML 内有效 JSON、URL / 表单参数、键值数组和 HTML input。主模块已包含此功能，不要再同时开启独立扫描。提取器不执行页面脚本；普通 HTML、参数或键值数组里观察到的 token 可单独保存，不凭文本距离建立 SKU 关联。未知格式或达到解析边界时可能无法提取，空结果不证明商品或优惠不存在。

SKU 最多保留 300 个，命名 token、同对象关联与编码候选各最多保留 **200 条**。单个 token 必须是非空字符串且不超过 **2048 字符**；超长值拒绝收录，不截断后保存。token 与关联的 `count` 按响应计数：同一响应内重复只加一次，后续响应再次出现再增加；`scan.skus[].count` 累计提取器观察到的 SKU 次数。新字段保存在原有手机本地记录中，不保存完整响应或认证字段，不向网络上报，不在普通日志打印完整 token。

**关联只证明观察到的结构，不证明商店商品有效。** 仅当同一 JSON 对象的直接字段包含一个明确 SKU 和一个命名 offer token 字段（含 `offerIdToken` 等别名）时，才保存这对值；同对象的可选 `offerId` 可作为附加元数据。多个 SKU 或多个 token、父子或兄弟对象、同响应共现、文字位置相近，都不按猜测配对。没有可靠结构的 token 仍放入 token 清单，不能把它当成已确定对应某 SKU 的优惠。


Base64 / Base64URL 候选最多探测 **600 次**，从 Protobuf 长度字段或可打印 ASCII 恢复 SKU 文本。结果独立保存在 `scan.encodedCandidates`，每条 `format` 仅为 `protobuf` 或 `ascii`，`source` 仅为 `body`、`url` 或 `location`。它们表示编码中出现 SKU 文字的候选，不是已验证 offerIdToken、SKU / token 配对、Google 目录记录或 12个月计费证据；不把无标签编码值直接混成命名 token。恢复出的 SKU 观察值合并入 `scan.skus`，既有四项 SKU 改写规则保持不变。

如本机已有附件旧脚本保存的 `offerIdTokens`，仅把通过校验的 token 原值兼容导入观察清单。旧状态混合了来源，其 `skus` 附注不作为同对象证据，不据此生成 `offerLinks`、`encodedCandidates`，也不猜测 `body`、`url`、`location` 来源；当前空响应不会增加历史编码 SKU 的观察次数。只有实际再次观察并解出候选时，才记录该次候选与真实来源；没有实际设备响应时仍不能确认目标目录 ID。

| 新采集 / 导出字段 | 含义 |
|---|---|
| `scan.offerTokens` | 最多 200 条 `{token, count, lastSeen}`；命名字段提取或从旧记录兼容导入的观察值，不表示已验证优惠 |
| `scan.offerLinks` | 最多 200 条 `{sku, token, offerId, count, lastSeen}`；只保存同对象直接字段的明确关联，`offerId` 为可选元数据 |
| `scan.encodedCandidates` | 最多 200 条 `{token, skus, format, source, count, lastSeen}`；编码中恢复的 SKU 文本候选，不是已确认 offerIdToken 或 SKU / token 关联 |
| `scan.offerScan` | `{limit: 200, maxTokenLength: 2048, maxBodyChars: 4194304, maxBase64Probes: 600, base64Probes, tokenCount, truncated, limited}`；限额、本次编码探测数、本次不同命名 token 数与受限标记，不代表已穷尽服务器商品 |
| `scan.focus.skuPrefix` | 固定为 `g1.ios.ai.pro`；只是本地筛选条件，不是新造的目录 ID |
| `scan.focus.offerMarker` | 固定为字面标记 `12months_eft` |
| `scan.focus.skus` | 已采集 SKU 中，不区分大小写匹配 `g1.ios.ai.pro` 或 `g1.ios.ai.pro.` 家族的记录；保留原始 ID，不包含 `g1.ios.ai.profile…` |
| `scan.focus.offers` | 同对象关联同时满足 Pro 家族条件，且 SKU、`offerId` 或 token 中出现字面标记 `12months_eft` 的记录 |
| `scan.focus.encodedCandidates` | 同时满足 Pro 家族 SKU 与 `12months_eft` 字面条件的编码候选 |

报告的 **Lọc g1.ios.ai.pro / 12months_eft** 显示重点结果；**Liên kết SKU / offerIdToken** 显示全部已保存关联，**offerIdToken đã thu được** 显示全部已保存 token，**Ứng viên Base64 / protobuf** 显示全部已保存编码候选。重点结果为空时仍可检查完整 token、关联与编码候选清单。编码解码仅用于寻找 SKU 文本，不解释 token 权限或计费周期；即使含 `12months_eft` 字符串，也只标为文本候选，不能据此确认 12个月权益、EFT 资格、实际金额或可购买性。

查找实机记录时，保持新版主模块开启，在 Google App 逐个浏览账号实际提供的 Pro、月付、年付及优惠入口，等待新响应后返回报告刷新。先看 Pro 家族 SKU，再看同对象关联和完整 token 清单，最后点 **导出 JSON** 保存新的 `scan.skus`、`offerTokens`、`offerLinks`、`encodedCandidates`、`offerScan` 与 `focus`。当前没有真实响应样本，不能承诺已识别任何实际目录中的 Pro 12个月 EFT ID；服务器未下发的值无法被动收集。升级保留旧记录，缺失的新字段显示为空，不会从旧 SKU 推造 token 或关联。

## 4. 测试 12months_ip_90p 候选与 20TB / 30TB 映射

采集与改写由主模块自动先后执行，核对收银台时继续保持同一个 **G1 ACQ** 开启。

1. 确认新版 **G1 ACQ** 开启与小火箭连接，无需切换采集模块。
2. 核对当前配置右侧 **(i) → HTTPS 解密** 中的开关、`one.google.com` hostname 和 iOS 证书信任，然后重新连接小火箭。
3. 退出当前方案页，再从 **Google App（彩色 G）→ Google One 管理** 重新进入 **2TB / Pro** 方案。12个月优惠测试的源商品是原始 iOS 2TB；核对其它映射时分别打开页面实际提供的 20TB / 30TB 方案。
4. 从页面实际提供的方案进入订阅流程，核对 App Store 收银台中的 **商品名称、订阅周期、币种、初次金额、续费金额**。若未拉起收银台，记录屏幕上的实际提示；2TB、20TB、30TB 的结果分别记录。
5. 在 Safari 打开 [本地报告](https://one.google.com/g1-sku-report)，查看“最近一次 SKU 映射”的版本、执行时间与状态；“总替换次数”是全部映射总数，“其中 2TB”是 2TB / Pro 优惠改写数，下方按行显示完整源编号、实际目标与备用状态。
6. 点报告操作区的 **导出 JSON** 按钮，或打开 [JSON 导出地址](https://one.google.com/g1-sku-report?format=json)，保留 `reportVersion`、`configuredTarget`、`test.version`、`test.matchedFrom`、`test.target`、`test.targetOrigin`、`test.hitCount`、`test.annualHitCount`、`test.status` 与 `test.updatedAt`，将它们和本次 App Store 显示结果一起记录。

主脚本先从匹配 `^https://one\.google\.com/` 的 URL、Location 与可扫描正文采集 SKU，再仅对匹配 `^https://one\.google\.com/ai\?` 的响应识别完整明文编号并应用以下映射：

| 正文中的完整源 SKU | 默认目标 | 备用目标 |
|---|---|---|
| `g1.ios.2tb.` 前缀的完整 SKU | `g1.2tb.ai.12months_ip_90p`（用户指定候选） | 无 |
| `g1.ios.ai.2tb.m.ip_1mo_90p.acq`（完整匹配） | `g1.2tb.ai.12months_eft`（无 `.acq` 后缀） | 无 |
| `g1.ios.20tb.m.v2` | `g1.2tb.ai.18months_eft`（无 `.acq` 后缀） | 无 |
| `g1.ios.30tb.ai.pro.m` | `g1.ai.ultra.1month_eft.acq` | 无 |

原有 `g1.ios.2tb.` 前缀匹配到的完整源 ID 固定替换为候选 `g1.2tb.ai.12months_ip_90p`。新增完整源 ID `g1.ios.ai.2tb.m.ip_1mo_90p.acq` 固定替换为 `g1.2tb.ai.12months_eft`，目标没有 `.acq` 后缀；该源仅按完整编号匹配，不使用通配前缀，也不匹配带额外前后缀的近似编号。20TB 必须命中完整源 ID `g1.ios.20tb.m.v2`，固定替换为 `g1.2tb.ai.18months_eft`，目标没有 `.acq` 后缀。30TB 必须命中完整源 ID `g1.ios.30tb.ai.pro.m`，固定替换为 `g1.ai.ultra.1month_eft.acq`。

各项映射均没有备用目标，也不要求目标预先出现在正文中；即使原始正文携带旧 90p / 75p 商品 ID，也不会改用旧目标。这是响应正文中的字符串替换，不是向 App Store 查询商品目录。其它编号保持原样；所有映射都未命中时原样返回响应。

| 报告字段 | 含义 |
|---|---|
| `reportVersion` | 当前报告脚本版本 `v7.7.0`，与保存的执行记录版本分别显示 |
| `configuredTarget` | 当前配置的原有 `g1.ios.2tb.` 前缀候选 `g1.2tb.ai.12months_ip_90p`；新增精确 2TB 目标看对应行 `to` |
| `test.version` | 生成该执行记录的脚本版本；当前主脚本为 `g1-acq-v7.7.0`，保留的旧记录仍显示原版本 |
| `test.matchedFrom` | 本次响应实际命中的完整源 ID，逐行格式为 `{id, to, count, fallback}`；`to` 是该源本次实际目标，`count` 是该源的改写次数，当前脚本生成的 `fallback` 均为 `false`；旧记录中的 `fallback=true` 仍按历史备用状态展示 |
| `test.target` | 最近一次执行时实际保存的原有 2TB 前缀候选；新记录为 `g1.2tb.ai.12months_ip_90p`，旧 v7.3 / v7.4 记录保留 `g1.2tb.ai.annual_ip_90p.acq`，旧 v7.2 记录保留 `g1.2tb.ai.annual.3months_ip_90p.acq`，旧 v1 / v7.1 记录仍为 `g1.2tb.ai.annual`；新增精确 2TB 源的目标 `g1.2tb.ai.12months_eft` 与 20TB / 30TB 的实际目标看各行 `to` |
| `test.targetOrigin` | 新候选记录与旧 v7.3 / v7.4 记录为 `user-specified`，旧 v7.2 记录保留 `pattern-derived`，旧 v1 / v7.1 普通年付记录为 `legacy`，无执行记录时为空 |
| `test.hitCount` | 本次响应全部映射总改写数；脚本输出中的 `hits=N` 对应此值 |
| `test.annualHitCount` | 沿用兼容字段名，统计本次响应中原有 `g1.ios.2tb.` 前缀与新增精确源 ID `g1.ios.ai.2tb.m.ip_1mo_90p.acq` 的 2TB / Pro 改写总数；脚本输出中的 `annualHits=N` 对应此值，报告显示“其中 2TB”；字段名与计数不证明年付扣款 |
| `test.updatedAt` | 最近一次执行时间，UTC |
| `test.status = rewritten` | 至少一项映射已执行字符串替换；只有 20TB / 30TB 命中时也为此状态 |
| `test.status = no-match` | 本次文本响应映射完整源 ID 都未命中，响应原样返回 |
| `test.status = non-text` | 本次响应没有可处理的文本正文，响应原样返回 |

当前主脚本日志使用 `[g1-acq]` 前缀，只输出版本、状态、计数与错误；映射汇总格式为 `g1-acq-v7.7.0 hits=N annualHits=N`，分别对应 `hitCount` 与 `annualHitCount`。采集汇总中的 `offerTokens=N`、`offerLinks=N` 表示本机已保留的 token 与关联条数。主模块和独立扫描器不打印逐个 SKU、完整 token；当前主脚本也不再打印逐行映射。历史格式 `源 SKU → 实际目标 xN` 与 `fallback=75p` 仅供核对旧日志，实际源 ID、目标 `to`、次数与历史备用状态请看本地报告 `test.matchedFrom`。

这里保存的是**最近一次进入 SKU 改写检查的执行记录**，不是累计测试历史；该范围内后续零命中响应也会更新记录。`configuredTarget` 表示原有 2TB 前缀候选配置，`test.target` 表示该候选最近执行时的保存值；新增精确 2TB 源 ID 的目标看对应行 `to`，不会改写这两个兼容字段；旧 v7.3 / v7.4 记录仍保留 `g1.2tb.ai.annual_ip_90p.acq` 与 `user-specified`，旧 v7.2 记录保留 `g1.2tb.ai.annual.3months_ip_90p.acq` 与 `pattern-derived`，旧 v1 / v7.1 记录保留 `g1.2tb.ai.annual` 与 `legacy`。升级本身保留历史 ID 与旧 `test.targetOrigin`，不会将它们重标为当前候选或 `user-specified`。当前配置与保存目标不同时，先对照 `test.version` 与执行时间。命中次数仅证明文本替换，不证明 App Store 接受目标商品或已完成订阅。

`hitCount=0` 与 `status=no-match` 表示本次文本响应所有映射都未命中，不等于账号没有 2TB 商品，也不等于目标商品不存在。若 `annualHitCount=0`、`hitCount>0`，说明只命中了 20TB / 30TB，状态仍为 `rewritten`；判断 2TB 12个月优惠测试须看 `annualHitCount`，再对照各行 `id` 与 `to`。

同一个主模块的采集范围覆盖整个 `one.google.com/`，并可识别转义点号；SKU 改写仅处理 `/ai?` 原文中的完整明文编号。因此报告中出现候选 ID，不保证另一条 `/ai?` 响应能命中。目标档未命中时继续浏览实际提供的方案，按第 3 节查看被动采集到的完整编号，无需切换模块，也不推测新的 iOS SKU。

## 5. 本地结果页、导出与清理

保持小火箭连接与新版 **G1 ACQ** 开启，在 Safari 地址栏粘贴完整[本地报告地址](https://one.google.com/g1-sku-report)。页面上方应显示 **本机脚本已接管** 和 **v7.7.0** 标识，操作区有 **导出 JSON** 按钮；点按钮即可导出，也可使用下面的直接地址：

| 地址 | 动作 |
|---|---|
| [本地报告](https://one.google.com/g1-sku-report) | 显示累计采集结果与最近一次 SKU 合并测试记录 |
| [导出 JSON](https://one.google.com/g1-sku-report?format=json) | 返回 `g1-sku-report.json` 下载响应 |
| [清空本工具记录](https://one.google.com/g1-sku-report?clear=1) | 清空本工具的采集记录与最近测试记录 |

**地址使用 Google 域名，报告页面由手机本机脚本提供。** Shadowrocket 的 `http-request` 脚本接管 `https://one.google.com/g1-sku-report`，也支持末尾 `/` 和 query，在本机生成 HTML 或 JSON 并直接返回，不把这次请求交给 Google。HTML 不加载外部资源，报告与导出脚本没有网络上报调用。

若看到 Google 普通页面或 404，说明本次没有展示本机报告。核对新版 **G1 ACQ** 开启、小火箭连接、**当前配置 (i) → HTTPS 解密**、`one.google.com` hostname 和 iOS 中已受信任的证书，再把完整报告 URL 粘贴到 Safari 地址栏打开。

数据保存在手机 `$persistentStore` 中，两个键名与 `schemaVersion: 1` 均保持不变：

| 键 | 内容 |
|---|---|
| `g1.sku.scan.v1` | 候选 ID、命名 offer token、同对象关联、编码候选、累计次数、最近发现时间、实际采集版本、采集限额状态与响应计数；主模块另存最多 10 条脱敏响应事件 |
| `g1.pro.annual.test.v1` | 最近一次执行的脚本版本、2TB 源前缀、映射命中源 ID 与逐行实际目标及备用状态、2TB 目标、总改写数、2TB 改写数、时间和状态 |

HTML 按命中行显示完整源 ID、实际目标、次数与备用状态，避免把 `test.target` 误读成新增精确 2TB 源 ID 或 20TB / 30TB 的目标。新版结果页兼容旧 v1 的仅 2TB 记录：旧行缺少 `to` 时补为原普通年付目标 `g1.2tb.ai.annual`，缺少的 `annualHitCount` 从旧 2TB 行次数计算；旧行按未使用备用档展示。旧 v1 / v7.1 记录的 `test.target` 保留原普通年付目标，`test.targetOrigin` 显示 `legacy`；旧 v7.2 记录保留实际保存的 `g1.2tb.ai.annual.3months_ip_90p.acq` 与 `pattern-derived`；旧 v7.3 / v7.4 记录保留 `g1.2tb.ai.annual_ip_90p.acq` 与 `user-specified`，升级不重标旧 ID 或旧来源。保留旧记录无需先清空这两个键。

JSON 中的 SKU 采集字段是 `scan.skus`，每项含 `id`、`count`、`lastSeen`；`scan.offerTokens`、`scan.offerLinks`、`scan.encodedCandidates`、`scan.offerScan` 与 `scan.focus` 提供命名 token、同对象关联、编码候选、限额和重点筛选结果，详见第 3 节；测试字段见第 4 节。旧记录没有这些新字段时显示为空，不从旧 SKU 清单推测 token。报告把 **报告版本 `reportVersion=v7.7.0`** 与 **实际采集记录版本 `scan.version`** 分别显示；后者来自保存记录，本版主采集器为 `g1-acq-v7.7.0`。旧脚本记录显示 **旧采集记录；尚未保存本版采集响应记录。** 版本未知或无记录时标为 **尚未保存本版采集响应记录**。仅更新报告脚本不代表新版采集器已经收到响应，这些标签也不构成手机故障结论。

| 采集字段 | 含义 |
|---|---|
| `scan.version` | 生成实际采集记录的脚本版本，保留旧记录原值 |
| `scan.scannedResponses` | 正文为字符串且非跳过的二进制媒体时，累计可扫描正文响应数 |
| `scan.matchedResponses` | URL、Location 或正文任一来源识别出 SKU 的累计响应数，重复 SKU 也算，正文不可扫描时同样可增加 |
| `scan.matchedOfferTokenResponses` | 当前响应发现至少一个命名 offer token 时累计加一；本次不同命名 token 数另看 `scan.offerScan.tokenCount` |
| `scan.nonTextResponses` | 正文非字符串或为跳过的二进制媒体时累计加一；仍可采集 URL / Location，与 `scannedResponses` 分开 |
| `scan.recentResponses` | 主模块最多 10 条事件；JSON 数组按接收顺序旧 → 新保存，超过 10 条时移出最旧事件；HTML 表格按新 → 旧展示；独立扫描不生成此诊断 |

每条响应事件包含以下字段：

| 事件字段 | 含义 |
|---|---|
| `at` | 本次响应处理时间 |
| `path` | 固定类别路径，仅取 `/`、`/ai`、`/plans`、`/_/…/data/batchexecute` 或 `[其他 one.google.com 路径]` |
| `bodyType` | 正文可扫描性：`text` 或 `non-text`；不包含正文内容，不描述 URL / Location 是否有数据 |
| `status` | 本次响应的采集诊断状态，见下表 |
| `candidateCount` | 本响应内识别出的不同候选 ID 数；同一 ID 多次出现只计 1 个候选 |
| `addedCount` | 本次新加入并实际保留的不同 ID 数 |
| `omittedCount` | 本次因 300 个 ID 容量限制而丢弃的不同 ID 数；同一未保留 ID 多次出现只计 1 次丢弃 |

| `status` | 含义 |
|---|---|
| `new-skus` | 正文可扫描且 `addedCount>0`，本次保留新增 ID；即使 `omittedCount>0` 仍优先此状态 |
| `known-skus` | 正文可扫描，扫描来源中的 SKU 均已保存，只更新次数与时间 |
| `no-skus` | 正文可扫描，但 URL、Location 与正文均未识别到 SKU；不表示没有 token |
| `limit-reached` | 正文可扫描且 `addedCount=0`、`omittedCount>0`：没有新保留 ID，存在容量丢弃 |
| `non-text` | 正文不可扫描，增加 `nonTextResponses`；URL / Location 仍可提供 SKU 或 token，事件计数可大于零 |

事件 SKU 计数覆盖 URL、Location 与可扫描正文；`bodyType` / `status=non-text` 仅描述正文，不表示其它来源没有数据。`no-skus` 也不代表没有 token，请另看 `scan.matchedOfferTokenResponses`、`scan.offerScan.tokenCount`、`scan.offerTokens` 与 `scan.offerLinks`。`candidateCount`、`addedCount`、`omittedCount` 按每个响应中的不同 ID 计数；`scan.skus[].count` 累计 SKU 观察次数，两者含义不同。已有记录缺少 `recentResponses` 时，报告不根据旧时间或累计计数补造响应历史；只有后续实际处理的响应才产生新事件。旧计数和原始候选继续保留，最近 10 次响应也不代表全部历史。

响应路径固定脱敏：`/_/…/data/batchexecute` 中的 `…` 是固定展示文本；其它路径统一归入 `[其他 one.google.com 路径]`。事件与导出不保存 query、完整 URL、请求头、响应头、请求体或响应正文。报告展示最后一次响应时间与最近响应历史，用它们对照本次打开方案页的时间。

`?clear=1` 仍是手动操作，只清空上述两个键的内容，不执行小火箭“清空所有数据”；读取报告和刷新普通报告地址不清理记录。只有明确要重置历史时才先导出再清理，清单没有新增时先比较计数、版本与事件，保留诊断依据。清空后返回不带 `clear=1` 的[本地报告地址](https://one.google.com/g1-sku-report)，避免刷新清理地址时再次清除新记录。

## 6. 在 iOS 小火箭中采集与验证隐藏 SKU

当前项目运行在 **iPhone + Shadowrocket + Google App** 中。主模块已包含 SKU 与命名 `offerIdToken` 采集，无需再开独立扫描模块。采集检查匹配 URL、Location 与可扫描正文：即使某个编号的方案未显示在页面上，仍可能从扫描范围内恢复出候选。受正文、格式与探测边界限制，并非响应中所有编码值都能被识别。页面只显示几个方案，不等于响应里只有几个编号。

1. 保持同一个 **G1 ACQ** 开启，在 Google App 内依次打开实际提供的 2TB / Pro、月付、年付和优惠入口；每次等页面加载完成，让模块收集不同入口下发的原始响应。
2. 在 Safari 打开[本地报告](https://one.google.com/g1-sku-report)，查看“浏览页面时采集到的候选 SKU”；这部分保存改写前取得的完整编号，最多 300 个。
3. 对本轮指定候选 `g1.2tb.ai.12months_ip_90p`，重新进入原始 2TB / Pro 方案，让模块替换该入口中的源编号；在报告中核对 `test.version=g1-acq-v7.7.0`、`test.target` 和对应行的 `to`。
4. 从该方案进入原生订阅流程，查看 App Store 实际显示的商品、周期、初次与续费金额；保存实际显示结果，再导出 JSON 对照脚本执行记录。

原始采集清单和配置的替换候选分别保存。模块自身写入的新目标不会自动成为“采集到的隐藏 SKU”；服务器没有下发的编号也不在这次采集结果中。当前小火箭脚本处理网络响应，没有直接调用 Google App 内 StoreKit 的接口，报告中的“替换成功”仅描述文本改写。

原生 iOS 商品查询使用 StoreKit `Product.products(for:)` 或 `SKProductsRequest`，由对应 App 上下文提交已知 ID；这类查询返回商品详情，并非列出全部商品的目录接口。本项目的手机操作流程是采集原始编号、替换指定候选、查看原生订阅返回，再保存报告。

## 7. 常见结果的判断

| 观察结果 | 下一步 |
|---|---|
| 报告页显示“暂无记录”或“尚未保存本版采集响应记录” | 先保存实际 `scan.version` 与计数，再重新进入 Google App 实际提供的 2TB / Pro 页面并刷新报告；未知版本或无记录不直接等于手机故障 |
| 报告为 `v7.7.0`，采集区标为“旧采集记录” | 报告已升级，保存的采集记录仍来自旧脚本；比较实际 `scan.version`、计数与最近响应时间，重新打开方案后再核对 |
| 旧记录没有 `recentResponses` | 保留原候选与累计计数，等待实际新响应填入历史；报告不把旧计数伪造成最近活动 |
| Safari 显示 Google 普通页面或 404 | 当前未展示本机报告；按第 5 节核对新版 G1 ACQ、连接、当前配置的 HTTPS 解密、`one.google.com` 与受信任证书，将完整报告 URL 粘贴到 Safari 地址栏打开 |
| 页面没有“本机脚本已接管”、`v7.7.0` 标识或“导出 JSON”按钮 | 核对已按第 1 节升级为新版主模块，再重新打开第 5 节本机报告；直接 JSON 导出地址也列在第 5 节 |
| 报告页显示本地存储接口暂未就绪 | 页面脚本未取得 `$persistentStore` 读取接口，当前页面不构成采集成功的证据；记录显示结果与小火箭版本 |
| 清单仍是旧 ID，但文字响应计数增加且状态为 `known-skus` | 本次收到重复数据，累计次数与发现时间会更新；保持现有记录，比较各响应的候选数与新增数 |
| `scannedResponses`、`matchedResponses`、`nonTextResponses` 与最新响应时间均未变 | 只能确认本轮未保存新的采集记录，存储写入失败也会保留旧计数；先看脚本日志 `saved=no` / `SKU collection unavailable`，再按缓存、`one.google.com/` 匹配范围、模块开关、VPN、当前配置 HTTPS 解密、证书信任和 hostname 逐项核对，重新打开实际方案并刷新报告 |
| 可扫描正文计数增加，最近状态为 `no-skus` | 本次 URL、Location 与可扫描正文未识别到 SKU；仍可检查命名 token 和编码候选，再核对实际方案，不凭空生成 ID |
| `nonTextResponses` 增加，最近状态为 `non-text` | 正文不可扫描；URL / Location 仍可能产生 SKU 或 token，核对事件计数与 token 字段，再记录类型、脱敏路径及其它实际方案页 |
| 最近状态为 `new-skus` | 正文可扫描且 `addedCount>0`，本次保留新 ID；即使同时 `omittedCount>0` 仍为 `new-skus`；候选 `count` 累计观察次数 |
| 已采集到 2TB ID，但 `annualHitCount` 为 0 | 对照执行时间、原有 `g1.ios.2tb.` 前缀或新增精确源 ID `g1.ios.ai.2tb.m.ip_1mo_90p.acq`，以及 `/ai?` 匹配范围；按第 3 节重新采集 |
| `status=rewritten`、`hitCount>0`，但 `annualHitCount=0` | 本次只改写了 20TB / 30TB；查看各行 `id`、`to` 与 `fallback`，此状态不代表 2TB 优惠改写命中 |
| `status=no-match`、`hitCount=0` | 本次文本响应所有映射都未命中；对照第 4 节完整源 ID 与 URL 范围，再按第 3 节采集 |
| 旧记录中的 `fallback=true` | 该历史记录曾选用 75p 备用档，报告继续显示原始 `to` 与备用状态；当前各项固定映射的新记录均为 `fallback=false` |
| `hitCount` 大于 0，但收银台报错或未出现 | 记录实际提示与该档的实际目标 `to`；文本替换成功与商店接受目标商品分别记录 |
| App Store 商品、周期或金额与预期不同 | 按本次 App Store 返回商品与收银台显示记录；候选编号中的 `12months`、`90p` 与截图价格标签不替代实际周期与金额 |
| 正文可扫描，`addedCount=0` 且 `omittedCount>0`，状态为 `limit-reached` | 没有新保留 ID，存在容量丢弃；已保存 ID 仍更新；只有明确要为新一轮采集释放容量时，先导出再手动用 `?clear=1` 清理两键 |

按第 3 节执行“先记录 → 重开实际方案 → 刷新比较”的单次诊断即可保留前后证据；新编号由实际响应内容决定，重复安装或反复清空记录不会促使服务器下发新 SKU。

## 8. 实机记录模板

```text
采集 / 测试时间（含时区）：[填写]
iOS / Google App / Shadowrocket 版本：[填写]
主模块名称：G1 ACQ
主模块地址：https://cdn.jsdelivr.net/gh/nhoxloxchoi11/g1-acq@v7.7.0/g1-acq-v7.sgmodule
主模块发布版本：v7.7.0
主模块脚本版本：g1-acq-v7.7.0
运行方式：单模块被动采集原始 SKU 与最近10次响应，再执行 SKU 改写（含 2TB 用户指定候选）
当前启用主模块：G1 ACQ
报告顶部本机标识与版本：[填写实际显示]
报告脚本版本 reportVersion：[填写实际显示；当前 v7.7.0]
实际采集脚本版本 scan.version：[填写实际保存值；主模块 g1-acq-v7.7.0；独立替代扫描 g1-sku-scan-v7.7.0]
命名 token 数 / 同对象关联数 / 编码候选数：[按 scan.offerTokens / scan.offerLinks / scan.encodedCandidates 填写；完整值以导出 JSON 为准]
Pro 家族 / 12months_eft 文本候选：[按 scan.focus 填写；未观察到不推造]
采集限额状态 offerScan：[按实际 truncated / limited / base64Probes 填写]
采集版本提示：[填写实际显示；旧采集记录 / 尚未保存本版采集响应记录 / 本版状态]
打开方案前文字计数 scan.scannedResponses：[填写]
打开方案后文字计数 scan.scannedResponses：[填写]
打开方案前命中计数 scan.matchedResponses：[填写]
打开方案后命中计数 scan.matchedResponses：[填写]
打开方案前非文本计数 scan.nonTextResponses：[填写；旧记录缺少则记“未记录”]
打开方案后非文本计数 scan.nonTextResponses：[填写]
命名 token 命中响应数 scan.matchedOfferTokenResponses：[填写前后计数；本次不同 token 数见 offerScan.tokenCount]
打开方案前最近响应时间：[填写；旧记录缺少历史则记“未记录”]
打开方案后最近响应时间：[填写]
最近响应 scan.recentResponses：[按JSON接收顺序旧→新填写最多10条；HTML表格新→旧；缺少历史则记“未记录”]
最新响应 at / path / bodyType：[填写实际保存值；路径只填脱敏类别]
最新响应 status：[填写 new-skus / known-skus / no-skus / limit-reached / non-text]
最新响应 candidateCount / addedCount / omittedCount：[填写不同候选数 / 新保留数 / 容量丢弃数]
原有 2TB 前缀配置目标 configuredTarget：g1.2tb.ai.12months_ip_90p
新增精确 2TB 源 ID：g1.ios.ai.2tb.m.ip_1mo_90p.acq；目标：g1.2tb.ai.12months_eft（无 .acq；实际执行见对应行 to）
候选来源：用户截图指定（user-specified），字面值 g1.2tb.ai.12months_ip_90p，无 .acq 后缀
截图价格标签：$1.99 × 12 months = $23.88/year；连续12个月的月度优惠标签，非已验证的 iOS 价格或扣款周期
截图折扣含义：90p = 90% off，约一折，非实付90%的九折
截图标题：Pro 5TB；截图对应原有 iOS 2TB 前缀映射，截图不证明5TB权益
候选验证状态：待 App Store 实际返回商品；按本轮商品名称、周期、初次与续费金额填写
是否看到并点按“导出 JSON”按钮：[填写]
Google App 内实际打开的方案名称：[填写 2TB / Pro、20TB 或 30TB 的实际名称]
采集到的原始 iOS 2TB 完整 SKU：[填写原文；未出现则记“未采集到”]
采集到的原始 iOS 20TB / 30TB 完整 SKU：[填写原文；未出现则记“未采集到”]
执行脚本版本 test.version：[填写]
最近测试时间 test.updatedAt：[填写]
逐行源 ID、实际目标、次数、备用状态 test.matchedFrom：[填写 {id, to, count, fallback}]
最近执行的原有 2TB 前缀候选 test.target：[填写实际保存值；旧记录保留其原始目标 ID]
最近执行的目标来源 test.targetOrigin：[填写 user-specified / pattern-derived / legacy / 空值；保留旧来源]
全部映射总改写数 test.hitCount：[填写]
2TB / Pro 改写数 test.annualHitCount：[填写原有前缀与新增精确 2TB 源的合计；兼容字段名，不证明年付扣款]
执行状态 test.status：[填写]
是否拉起 App Store 收银台：[填写]
App Store 商品名称：[填写实际显示]
订阅周期：[填写实际显示]
币种 / 初次金额 / 续费金额：[填写实际显示]
实际错误提示：[填写原文；未出现则记“无”]
是否实际完成购买：[填写]
购买后 Google One 账户显示的权益：[仅在实际购买后填写]
本轮 JSON 导出文件：[填写]
```
