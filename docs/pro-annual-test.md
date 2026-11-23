# Pro 12个月优惠测试与 SKU 扫描

**只安装、开启一个 G1 ACQ**，即可被动采集原始 SKU、执行三档改写并查看本机报告；`v7.5.1` 继续提供最近 10 次响应、本次新增与重复诊断。脚本先采集 `one.google.com/` 原始文字响应中的商品编号，再仅在 `/ai?` 响应中把 `g1.ios.2tb.` 前缀的 **原始 iOS 2TB 完整 SKU** 改为 `g1.2tb.ai.12months_ip_90p`，同时保留 20TB 优惠映射与 75p 回退，并将 30TB 固定改为 `g1.ai.ultra.1month_eft.acq`。2TB 使用用户指定的固定候选且没有备用档，完整映射见第 4 节；当前响应脚本版本为 `g1-acq-v7.5.1`。

采集器只读取手机实际收到的匹配响应，**不会主动查询全量 SKU**。旧 ID 再次出现会增加次数，但不会变成新增 ID；看到旧清单本身不足以判断手机脚本失效，本轮没有已验证的实机故障结论。

**本轮 12个月优惠测试的完整候选为 `g1.2tb.ai.12months_ip_90p`，没有 `.acq` 后缀。** 用户截图首项提供该候选与价格标签 `$1.99 × 12 months = $23.88/year`，图示表达连续 12 个月的月度优惠；`90p` 表示 **90% off，约一折**，不是实付 90% 的九折。`$23.88/year` 是截图中的 12 个月合计标签，不是一次年付扣款的证据。

截图标题为 **Pro 5TB**，本轮源商品仍是 `g1.ios.2tb.` 前缀的原始 iOS 2TB 完整 SKU，没有新增 5TB 源前缀。截图是候选与价格标签的来源，不是已验证的 iOS 商店商品资料，也不证明实际 iOS 价格、扣款周期或 5TB 权益。操作环境是 iPhone 上的 Shadowrocket 与 Google App；候选名称、周期、初次与续费金额待 App Store 实际返回商品后核对，权益以 Google One 账户显示为准。离线测试验证字符串匹配与报告行为。

## 1. 安装或升级主模块

**G1 ACQ — 被动采集、三档改写、最近 10 次响应诊断与 JSON 导出**

```text
https://cdn.jsdelivr.net/gh/nhoxloxchoi11/g1-acq@v7.5.1/g1-acq-v7.sgmodule
```

首次安装时在小火箭模块管理中添加上面的地址并启用；从旧版本升级时，将旧 **G1 ACQ** 替换为此地址一次。模块名仍为 **G1 ACQ**，安装入口与全部内部脚本均固定引用 `@v7.5.1`，无需单独添加脚本。安装或升级后重新连接，再重新打开 Google App 的方案页。升级保留历史记录；重复安装不会促使服务器下发新 SKU，诊断时先比较版本、计数与响应时间。

采集和改写在同一个主模块中依次执行，无需另装或切换 **G1 SKU Scan**。只装了一个主模块时，没有额外关闭步骤；若曾安装独立扫描器、**G1 Pro Annual Test** 或其它改写副本，停用这些旧副本，避免重复计数或改写。历史 `v7.0.0` / `v7.1.0` / `v7.2.0` / `v7.3.0` / `v7.4.0`、`pro-annual-test-v1` / `pro-annual-test-v2` 标签保持不动。

本版响应活动诊断来自主脚本 `g1-acq-v7.5.1`。**G1 Pro Annual Test** 兼容入口引用同一新脚本，但仍仅匹配 `/ai?`；**G1 SKU Scan** 独立兼容入口只更新下载 pin，扫描脚本保留历史实现，采集记录版本仍为 `pro-annual-test-v2`，没有新增响应活动字段。新版报告读取该独立扫描记录时显示真实旧版本与 **旧采集记录**，`recentResponses` 为空，不补造活动。

主模块包含本地报告脚本，只追加 MITM hostname `one.google.com`，并沿用原有全局 UDP 443 拦截规则；后者也会影响其它 App 的 HTTP/3、速度或连通性。

## 2. 配置 HTTPS 解密

模块要处理 HTTPS 响应，需在当前使用的配置中启用解密并信任证书。

1. 启用第 1 节 `v7.5.1` 地址安装的 **G1 ACQ**，旧版用户按第 1 节升级一次，保持小火箭 VPN 连接。
2. 进入 **配置页 → 当前使用配置右侧的 (i) 图标 → HTTPS 解密**，打开解密开关。
3. 已有可用且已受信任的 Shadowrocket 证书时直接沿用；尚未配置证书时，在该页生成并安装证书，再前往 iOS **设置 → 通用 → VPN 与设备管理** 完成描述文件安装。
4. 首次配置证书时，前往 iOS **设置 → 通用 → 关于本机 → 证书信任设置**，开启对应 Shadowrocket 根证书的信任。
5. 在当前配置的 **HTTPS 解密 hostname 列表**中核对 `one.google.com`。模块使用 `%APPEND%` 追加该域名；此处是 HTTPS 解密列表，不是 DNS Hosts。
6. 更改模块开关或解密配置后重新连接小火箭，再重新进入 Google App 的方案页面。

[README 中的配置入口截图](../README.md#安装shadowrocket--小火箭)展示了当前配置右侧的 `(i)` 入口。MITM hostname 覆盖 `one.google.com` 整个域名，脚本读取与改写范围由下文的 URL 匹配限定。

## 3. 浏览方案，被动采集原始 SKU

保持同一个 **G1 ACQ** 开启即可。每次处理 `one.google.com/` 的文字响应时，主脚本先采集原始正文，再检查该响应是否需要三档改写，记录的候选编号不会被本次后续改写替换；匹配的非文本响应只计入非文本诊断。

1. 保持小火箭连接，在同一手机 Safari 地址栏粘贴完整[本地报告地址](https://one.google.com/g1-sku-report)，核对 **本机脚本已接管** 与报告版本 **v7.5.1**；先记录实际 `scan.version`、`scannedResponses`、`matchedResponses`、`nonTextResponses` 和最新响应时间。
2. 打开 **Google App（彩色 G 图标）→ Google One 管理**，重新进入页面实际提供的 **2TB / Pro** 方案；核对保留映射时，再浏览实际提供的 **20TB / 30TB** 方案。
3. 页面提供月付、年付切换时，逐个浏览并等待加载完成。只有新收到的匹配响应才产生采集活动，无需完成购买；账号、地区、App 版本决定实际显示的方案与控件，页面缓存也会影响是否发出新请求。
4. 返回 Safari 刷新报告，对比计数和最新响应，查看本次新增数与状态。计数增长且 `known-skus` 表示重复数据；清单没有新增不等于采集停止。计数与最新响应时间均未变，只能确认本轮未保存新的采集记录；存储写入失败也会保留旧计数，按第 7 节核对 `saved=no` / `SKU collection unavailable` 日志、缓存、匹配范围与模块配置。
5. 查看“浏览页面时采集到的候选 SKU”，记录完整编号、次数、最近发现时间。寻找实际出现的 `g1.ios.2tb.` 前缀完整编号；20TB / 30TB 对照第 4 节的两个完整源 ID，不自行补全或猜测后缀。
6. 点报告操作区的 **导出 JSON** 按钮保存结果，也可直接打开 [JSON 导出地址](https://one.google.com/g1-sku-report?format=json)。

被动采集覆盖 `https://one.google.com/` 下的文字响应，跳过 `/g1-sku-report`、末尾带 `/` 的同一路径及其 query。它识别 `g1.*` 与 `com.google.one.*` 字符串，按 ID 去重累计出现次数；同一 ID 在一个响应中重复出现，或在后续响应中再次出现，都会增加次数，次数不是购买次数。

最多保留 **300 个不同 ID**。达到上限后继续更新已保存 ID 的次数和时间；超出上限的新 ID 不再加入列表，`omittedCount` 记录本次因容量丢弃的不同 ID 数。`addedCount>0` 时优先标为 `new-skus`，即使同时存在容量丢弃；只有 `addedCount=0` 且 `omittedCount>0` 时才标为 `limit-reached`。保留旧清单即可比较新增与重复；只有明确要重置历史记录时，才在导出后手动执行第 5 节的两键清理，日常诊断无需清空。

采集会在用于识别的文本副本中还原 `\u002e`、`\x2e` 与 HTML 点号实体；这个还原步骤不修改响应。采集完成后，仅匹配 `/ai?` 的响应进入三档改写，其它响应原样返回。脚本不读取请求头或请求体，不保存完整响应正文，不查询 App Store，不向外发送采集数据。

## 4. 测试 12months_ip_90p 候选与 20TB / 30TB 映射

采集与改写由主模块自动先后执行，核对收银台时继续保持同一个 **G1 ACQ** 开启。

1. 确认新版 **G1 ACQ** 开启与小火箭连接，无需切换采集模块。
2. 核对当前配置右侧 **(i) → HTTPS 解密** 中的开关、`one.google.com` hostname 和 iOS 证书信任，然后重新连接小火箭。
3. 退出当前方案页，再从 **Google App（彩色 G）→ Google One 管理** 重新进入 **2TB / Pro** 方案。12个月优惠测试的源商品是原始 iOS 2TB；核对保留映射时分别打开页面实际提供的 20TB / 30TB 方案。
4. 从页面实际提供的方案进入订阅流程，核对 App Store 收银台中的 **商品名称、订阅周期、币种、初次金额、续费金额**。若未拉起收银台，记录屏幕上的实际提示；2TB、20TB、30TB 的结果分别记录。
5. 在 Safari 打开 [本地报告](https://one.google.com/g1-sku-report)，查看“最近一次三档映射”的版本、执行时间与状态；“总替换次数”是三档总数，“其中 2TB”是 2TB / Pro 优惠改写数，下方按行显示完整源编号、实际目标与备用状态。
6. 点报告操作区的 **导出 JSON** 按钮，或打开 [JSON 导出地址](https://one.google.com/g1-sku-report?format=json)，保留 `reportVersion`、`configuredTarget`、`test.version`、`test.matchedFrom`、`test.target`、`test.targetOrigin`、`test.hitCount`、`test.annualHitCount`、`test.status` 与 `test.updatedAt`，将它们和本次 App Store 显示结果一起记录。

主脚本先从匹配 `^https://one\.google\.com/` 的原始文字响应采集 SKU，再仅对匹配 `^https://one\.google\.com/ai\?` 的响应识别完整明文编号并应用以下映射：

| 正文中的完整源 SKU | 默认目标 | 备用目标 |
|---|---|---|
| `g1.ios.2tb.` 前缀的完整 SKU | `g1.2tb.ai.12months_ip_90p`（用户指定候选） | 无 |
| `g1.ios.20tb.m.v2` | `g1.20tb.3months_ip_90p.acq` | `g1.20tb.3months_ip_75p.acq` |
| `g1.ios.30tb.ai.pro.m` | `g1.ai.ultra.1month_eft.acq` | 无 |

2TB 匹配到的完整源 ID 固定替换为候选 `g1.2tb.ai.12months_ip_90p`，没有备用目标，也不要求目标预先出现在正文中。30TB 必须命中完整源 ID `g1.ios.30tb.ai.pro.m`，固定替换为 `g1.ai.ultra.1month_eft.acq`，同样没有备用目标，也不要求目标预先出现在正文中。20TB 必须命中表中的完整源 ID，按原始响应正文决定目标，保留原有判断：

- 默认 90p 目标出现在正文中时，使用 90p；即使对应 75p 也出现，仍优先 90p。
- 默认 90p 目标未出现、对应 75p 备用目标出现时，使用该档的 75p，记录 `fallback=true`。
- 默认 90p 与对应 75p 均未出现时，仍按默认 90p 替换。

20TB 的回退判断只使用 20TB 的目标，30TB 的固定目标不参与回退判断。这是响应正文中的目标字符串判断，不是向 App Store 查询商品目录。其它编号保持原样；三档都未命中时原样返回响应。

| 报告字段 | 含义 |
|---|---|
| `reportVersion` | 当前报告脚本版本 `v7.5.1`，与保存的执行记录版本分别显示 |
| `configuredTarget` | 当前配置的 2TB 候选 `g1.2tb.ai.12months_ip_90p` |
| `test.version` | 生成该执行记录的脚本版本；当前主脚本为 `g1-acq-v7.5.1`，保留的旧记录仍显示原版本 |
| `test.matchedFrom` | 本次响应实际命中的完整源 ID，逐行格式为 `{id, to, count, fallback}`；`to` 是该源本次实际目标，`count` 是该源的改写次数，`fallback=true` 在当前脚本中表示 20TB 使用 75p 备用档 |
| `test.target` | 最近一次执行时实际保存的 2TB 目标；新记录为 `g1.2tb.ai.12months_ip_90p`，旧 v7.3 / v7.4 记录保留 `g1.2tb.ai.annual_ip_90p.acq`，旧 v7.2 记录保留 `g1.2tb.ai.annual.3months_ip_90p.acq`，旧 v1 / v7.1 记录仍为 `g1.2tb.ai.annual`；20TB / 30TB 的实际目标看各行 `to` |
| `test.targetOrigin` | 新候选记录与旧 v7.3 / v7.4 记录为 `user-specified`，旧 v7.2 记录保留 `pattern-derived`，旧 v1 / v7.1 普通年付记录为 `legacy`，无执行记录时为空 |
| `test.hitCount` | 本次响应三档总改写数；脚本输出中的 `hits=N` 对应此值 |
| `test.annualHitCount` | 沿用兼容字段名，仅统计本次响应的 2TB / Pro 优惠改写数；脚本输出中的 `annualHits=N` 对应此值，报告显示“其中 2TB”；字段名与计数不证明年付扣款 |
| `test.updatedAt` | 最近一次执行时间，UTC |
| `test.status = rewritten` | 三档中至少一档已执行字符串替换；只有 20TB / 30TB 命中时也为此状态 |
| `test.status = no-match` | 本次文本响应三档完整源 ID 都未命中，响应原样返回 |
| `test.status = non-text` | 本次响应没有可处理的文本正文，响应原样返回 |

当前日志使用 `[g1-acq]` 前缀，汇总格式为 `g1-acq-v7.5.1 hits=N annualHits=N`，逐行输出 `源 SKU → 实际目标 xN`；20TB 选用备用档时，该行附 `fallback=75p`。报告中的 `to` 与逐行日志对应，主汇总的 `hits` 与 `annualHits` 分别对应 `hitCount` 与 `annualHitCount`。

这里保存的是**最近一次进入三档改写检查的执行记录**，不是累计测试历史；该范围内后续零命中响应也会更新记录。`configuredTarget` 表示当前配置，`test.target` 表示最近执行时实际保存的目标；旧 v7.3 / v7.4 记录仍保留 `g1.2tb.ai.annual_ip_90p.acq` 与 `user-specified`，旧 v7.2 记录保留 `g1.2tb.ai.annual.3months_ip_90p.acq` 与 `pattern-derived`，旧 v1 / v7.1 记录保留 `g1.2tb.ai.annual` 与 `legacy`。升级本身保留历史 ID 与旧 `test.targetOrigin`，不会将它们重标为当前候选或 `user-specified`。当前配置与保存目标不同时，先对照 `test.version` 与执行时间。命中次数仅证明文本替换，不证明 App Store 接受目标商品或已完成订阅。

`hitCount=0` 与 `status=no-match` 表示本次文本响应三档都未命中，不等于账号没有 2TB 商品，也不等于目标商品不存在。若 `annualHitCount=0`、`hitCount>0`，说明只命中了 20TB / 30TB，状态仍为 `rewritten`；判断 2TB 12个月优惠测试须看 `annualHitCount`，再对照各行 `id` 与 `to`。

同一个主模块的采集范围覆盖整个 `one.google.com/`，并可识别转义点号；三档改写仅处理 `/ai?` 原文中的完整明文编号。因此报告中出现候选 ID，不保证另一条 `/ai?` 响应能命中。目标档未命中时继续浏览实际提供的方案，按第 3 节查看被动采集到的完整编号，无需切换模块，也不推测新的 iOS SKU。

## 5. 本地结果页、导出与清理

保持小火箭连接与新版 **G1 ACQ** 开启，在 Safari 地址栏粘贴完整[本地报告地址](https://one.google.com/g1-sku-report)。页面上方应显示 **本机脚本已接管** 和 **v7.5.1** 标识，操作区有 **导出 JSON** 按钮；点按钮即可导出，也可使用下面的直接地址：

| 地址 | 动作 |
|---|---|
| [本地报告](https://one.google.com/g1-sku-report) | 显示累计采集结果与最近一次三档合并测试记录 |
| [导出 JSON](https://one.google.com/g1-sku-report?format=json) | 返回 `g1-sku-report.json` 下载响应 |
| [清空本工具记录](https://one.google.com/g1-sku-report?clear=1) | 清空本工具的采集记录与最近测试记录 |

**地址使用 Google 域名，报告页面由手机本机脚本提供。** Shadowrocket 的 `http-request` 脚本接管 `https://one.google.com/g1-sku-report`，也支持末尾 `/` 和 query，在本机生成 HTML 或 JSON 并直接返回，不把这次请求交给 Google。HTML 不加载外部资源，报告与导出脚本没有网络上报调用。

若看到 Google 普通页面或 404，说明本次没有展示本机报告。核对新版 **G1 ACQ** 开启、小火箭连接、**当前配置 (i) → HTTPS 解密**、`one.google.com` hostname 和 iOS 中已受信任的证书，再把完整报告 URL 粘贴到 Safari 地址栏打开。

数据保存在手机 `$persistentStore` 中，两个键名与 `schemaVersion: 1` 均保持不变：

| 键 | 内容 |
|---|---|
| `g1.sku.scan.v1` | 候选 ID、累计次数、最近发现时间、实际采集版本、文字/命中/非文本响应计数、上限状态与最多 10 条脱敏响应事件 |
| `g1.pro.annual.test.v1` | 最近一次执行的脚本版本、2TB 源前缀、三档命中源 ID 与逐行实际目标及备用状态、2TB 目标、总改写数、2TB 改写数、时间和状态 |

HTML 按命中行显示完整源 ID、实际目标、次数与备用状态，避免把 `test.target` 误读成 20TB / 30TB 的目标。新版结果页兼容旧 v1 的仅 2TB 记录：旧行缺少 `to` 时补为原普通年付目标 `g1.2tb.ai.annual`，缺少的 `annualHitCount` 从旧 2TB 行次数计算；旧行按未使用备用档展示。旧 v1 / v7.1 记录的 `test.target` 保留原普通年付目标，`test.targetOrigin` 显示 `legacy`；旧 v7.2 记录保留实际保存的 `g1.2tb.ai.annual.3months_ip_90p.acq` 与 `pattern-derived`；旧 v7.3 / v7.4 记录保留 `g1.2tb.ai.annual_ip_90p.acq` 与 `user-specified`，升级不重标旧 ID 或旧来源。保留旧记录无需先清空这两个键。

JSON 中的核心采集字段是 `scan.skus`，每项含 `id`、`count`、`lastSeen`；测试字段见第 4 节。报告把 **报告版本 `reportVersion=v7.5.1`** 与 **实际采集记录版本 `scan.version`** 分别显示；后者来自保存记录，本版主采集器为 `g1-acq-v7.5.1`。旧脚本记录显示 **旧采集记录；尚未保存本版采集响应记录。** 版本未知或无记录时标为 **尚未保存本版采集响应记录**。仅更新报告脚本不代表新版采集器已经收到响应，这些标签也不构成手机故障结论。

| 采集字段 | 含义 |
|---|---|
| `scan.version` | 生成实际采集记录的脚本版本，保留旧记录原值 |
| `scan.scannedResponses` | 累计文字响应数；原有含义保持不变，非文本不计入 |
| `scan.matchedResponses` | 至少识别出一个候选 ID 的累计文字响应数，重复 ID 也算命中；原有含义保持不变 |
| `scan.nonTextResponses` | 累计非文本响应数，与文字响应分开 |
| `scan.recentResponses` | 最多 10 条事件；JSON 数组按接收顺序旧 → 新保存，超过 10 条时移出最旧事件；HTML 表格按新 → 旧展示 |

每条响应事件包含以下字段：

| 事件字段 | 含义 |
|---|---|
| `at` | 本次响应处理时间 |
| `path` | 固定类别路径，仅取 `/`、`/ai`、`/plans`、`/_/…/data/batchexecute` 或 `[其他 one.google.com 路径]` |
| `bodyType` | 响应体类型，不包含正文内容 |
| `status` | 本次响应的采集诊断状态，见下表 |
| `candidateCount` | 本响应内识别出的不同候选 ID 数；同一 ID 多次出现只计 1 个候选 |
| `addedCount` | 本次新加入并实际保留的不同 ID 数 |
| `omittedCount` | 本次因 300 个 ID 容量限制而丢弃的不同 ID 数；同一未保留 ID 多次出现只计 1 次丢弃 |

| `status` | 含义 |
|---|---|
| `new-skus` | `addedCount>0`，本次保留了新增 ID；即使 `omittedCount>0`，仍优先使用此状态 |
| `known-skus` | 本次识别出的 ID 均已保存，只更新累计次数与发现时间 |
| `no-skus` | 本次文字响应未识别到候选 ID |
| `limit-reached` | 仅在 `addedCount=0` 且 `omittedCount>0` 时使用：没有新保留 ID，存在容量丢弃 |
| `non-text` | 本次响应不是可采集文字，增加 `nonTextResponses` |

`candidateCount`、`addedCount`、`omittedCount` 按每个响应中的不同 ID 计数；`scan.skus[].count` 仍累计字符串出现次数，两者含义不同。已有记录缺少 `recentResponses` 时，报告不根据旧时间或累计计数补造响应历史；只有后续实际处理的响应才产生新事件。旧计数和原始候选继续保留，最近 10 次响应也不代表全部历史。

响应路径固定脱敏：`/_/…/data/batchexecute` 中的 `…` 是固定展示文本；其它路径统一归入 `[其他 one.google.com 路径]`。事件与导出不保存 query、完整 URL、请求头、响应头、请求体或响应正文。报告展示最后一次响应时间与最近响应历史，用它们对照本次打开方案页的时间。

`?clear=1` 仍是手动操作，只清空上述两个键的内容，不执行小火箭“清空所有数据”；读取报告和刷新普通报告地址不清理记录。只有明确要重置历史时才先导出再清理，清单没有新增时先比较计数、版本与事件，保留诊断依据。清空后返回不带 `clear=1` 的[本地报告地址](https://one.google.com/g1-sku-report)，避免刷新清理地址时再次清除新记录。

## 6. 在 iOS 小火箭中采集与验证隐藏 SKU

当前项目运行在 **iPhone + Shadowrocket + Google App** 中。采集读取整份匹配的原始文字响应：即使某个编号所在的方案没有显示在页面上，只要编号已经出现在该响应里，也会被提取。页面只显示几个方案，不等于响应里只有几个编号。

1. 保持同一个 **G1 ACQ** 开启，在 Google App 内依次打开实际提供的 2TB / Pro、月付、年付和优惠入口；每次等页面加载完成，让模块收集不同入口下发的原始响应。
2. 在 Safari 打开[本地报告](https://one.google.com/g1-sku-report)，查看“浏览页面时采集到的候选 SKU”；这部分保存改写前取得的完整编号，最多 300 个。
3. 对本轮指定候选 `g1.2tb.ai.12months_ip_90p`，重新进入原始 2TB / Pro 方案，让模块替换该入口中的源编号；在报告中核对 `test.version=g1-acq-v7.5.1`、`test.target` 和对应行的 `to`。
4. 从该方案进入原生订阅流程，查看 App Store 实际显示的商品、周期、初次与续费金额；保存实际显示结果，再导出 JSON 对照脚本执行记录。

原始采集清单和配置的替换候选分别保存。模块自身写入的新目标不会自动成为“采集到的隐藏 SKU”；服务器没有下发的编号也不在这次采集结果中。当前小火箭脚本处理网络响应，没有直接调用 Google App 内 StoreKit 的接口，报告中的“替换成功”仅描述文本改写。

原生 iOS 商品查询使用 StoreKit `Product.products(for:)` 或 `SKProductsRequest`，由对应 App 上下文提交已知 ID；这类查询返回商品详情，并非列出全部商品的目录接口。本项目的手机操作流程是采集原始编号、替换指定候选、查看原生订阅返回，再保存报告。

## 7. 常见结果的判断

| 观察结果 | 下一步 |
|---|---|
| 报告页显示“暂无记录”或“尚未保存本版采集响应记录” | 先保存实际 `scan.version` 与计数，再重新进入 Google App 实际提供的 2TB / Pro 页面并刷新报告；未知版本或无记录不直接等于手机故障 |
| 报告为 `v7.5.1`，采集区标为“旧采集记录” | 报告已升级，保存的采集记录仍来自旧脚本；比较实际 `scan.version`、计数与最近响应时间，重新打开方案后再核对 |
| 旧记录没有 `recentResponses` | 保留原候选与累计计数，等待实际新响应填入历史；报告不把旧计数伪造成最近活动 |
| Safari 显示 Google 普通页面或 404 | 当前未展示本机报告；按第 5 节核对新版 G1 ACQ、连接、当前配置的 HTTPS 解密、`one.google.com` 与受信任证书，将完整报告 URL 粘贴到 Safari 地址栏打开 |
| 页面没有“本机脚本已接管”、`v7.5.1` 标识或“导出 JSON”按钮 | 核对已按第 1 节升级为新版主模块，再重新打开第 5 节本机报告；直接 JSON 导出地址也列在第 5 节 |
| 报告页显示本地存储接口暂未就绪 | 页面脚本未取得 `$persistentStore` 读取接口，当前页面不构成采集成功的证据；记录显示结果与小火箭版本 |
| 清单仍是旧 ID，但文字响应计数增加且状态为 `known-skus` | 本次收到重复数据，累计次数与发现时间会更新；保持现有记录，比较各响应的候选数与新增数 |
| `scannedResponses`、`matchedResponses`、`nonTextResponses` 与最新响应时间均未变 | 只能确认本轮未保存新的采集记录，存储写入失败也会保留旧计数；先看脚本日志 `saved=no` / `SKU collection unavailable`，再按缓存、`one.google.com/` 匹配范围、模块开关、VPN、当前配置 HTTPS 解密、证书信任和 hostname 逐项核对，重新打开实际方案并刷新报告 |
| 文字响应计数增加，最近状态为 `no-skus` | 本次已处理的正文未出现匹配字符串；继续核对实际提供的 2TB / Pro 与月付、年付页面，不凭空生成 ID |
| 仅 `nonTextResponses` 增加，最近状态为 `non-text` | 已收到非文本响应，文字计数保持原含义；记录本次类型与脱敏路径，再核对其它实际方案页 |
| 最近状态为 `new-skus` | `addedCount>0`，本次实际保留了新 ID；即使同时 `omittedCount>0`，状态仍为 `new-skus`；候选列表中的 `count` 仍是累计出现次数 |
| 已采集到 2TB ID，但 `annualHitCount` 为 0 | 对照执行时间、完整源 ID、`g1.ios.2tb.` 前缀与 `/ai?` 匹配范围；按第 3 节重新采集 |
| `status=rewritten`、`hitCount>0`，但 `annualHitCount=0` | 本次只改写了 20TB / 30TB；查看各行 `id`、`to` 与 `fallback`，此状态不代表 2TB 优惠改写命中 |
| `status=no-match`、`hitCount=0` | 本次文本响应三档都未命中；对照第 4 节完整源 ID 与 URL 范围，再按第 3 节采集 |
| 当前脚本记录中 20TB 的 `fallback=true` | 默认 90p 未见于原始正文，已选用正文中的 75p；核对该行 `to` 和收银台实际结果；30TB 固定目标不使用备用档 |
| `hitCount` 大于 0，但收银台报错或未出现 | 记录实际提示与该档的实际目标 `to`；文本替换成功与商店接受目标商品分别记录 |
| App Store 商品、周期或金额与预期不同 | 按本次 App Store 返回商品与收银台显示记录；候选编号中的 `12months`、`90p` 与截图价格标签不替代实际周期与金额 |
| `addedCount=0` 且 `omittedCount>0`，状态为 `limit-reached` | 本次没有新保留 ID，存在容量丢弃；已保存 ID 仍更新；只有明确要为新一轮采集释放容量时，先导出再手动用 `?clear=1` 清理两键 |

按第 3 节执行“先记录 → 重开实际方案 → 刷新比较”的单次诊断即可保留前后证据；新编号由实际响应内容决定，重复安装或反复清空记录不会促使服务器下发新 SKU。

## 8. 实机记录模板

```text
采集 / 测试时间（含时区）：[填写]
iOS / Google App / Shadowrocket 版本：[填写]
主模块名称：G1 ACQ
主模块地址：https://cdn.jsdelivr.net/gh/nhoxloxchoi11/g1-acq@v7.5.1/g1-acq-v7.sgmodule
主模块发布版本：v7.5.1
主模块脚本版本：g1-acq-v7.5.1
运行方式：单模块被动采集原始 SKU 与最近10次响应，再执行三档改写（含 2TB 用户指定候选）
当前启用主模块：G1 ACQ
报告顶部本机标识与版本：[填写实际显示]
报告脚本版本 reportVersion：[填写实际显示；当前 v7.5.1]
实际采集脚本版本 scan.version：[填写实际保存值；本版主采集器为 g1-acq-v7.5.1]
采集版本提示：[填写实际显示；旧采集记录 / 尚未保存本版采集响应记录 / 本版状态]
打开方案前文字计数 scan.scannedResponses：[填写]
打开方案后文字计数 scan.scannedResponses：[填写]
打开方案前命中计数 scan.matchedResponses：[填写]
打开方案后命中计数 scan.matchedResponses：[填写]
打开方案前非文本计数 scan.nonTextResponses：[填写；旧记录缺少则记“未记录”]
打开方案后非文本计数 scan.nonTextResponses：[填写]
打开方案前最近响应时间：[填写；旧记录缺少历史则记“未记录”]
打开方案后最近响应时间：[填写]
最近响应 scan.recentResponses：[按JSON接收顺序旧→新填写最多10条；HTML表格新→旧；缺少历史则记“未记录”]
最新响应 at / path / bodyType：[填写实际保存值；路径只填脱敏类别]
最新响应 status：[填写 new-skus / known-skus / no-skus / limit-reached / non-text]
最新响应 candidateCount / addedCount / omittedCount：[填写不同候选数 / 新保留数 / 容量丢弃数]
当前配置目标 configuredTarget：g1.2tb.ai.12months_ip_90p
候选来源：用户截图指定（user-specified），字面值 g1.2tb.ai.12months_ip_90p，无 .acq 后缀
截图价格标签：$1.99 × 12 months = $23.88/year；连续12个月的月度优惠标签，非已验证的 iOS 价格或扣款周期
截图折扣含义：90p = 90% off，约一折，非实付90%的九折
截图标题：Pro 5TB；本轮源商品仍为原始 iOS 2TB，截图不证明5TB权益
候选验证状态：待 App Store 实际返回商品；按本轮商品名称、周期、初次与续费金额填写
是否看到并点按“导出 JSON”按钮：[填写]
Google App 内实际打开的方案名称：[填写 2TB / Pro、20TB 或 30TB 的实际名称]
采集到的原始 iOS 2TB 完整 SKU：[填写原文；未出现则记“未采集到”]
采集到的原始 iOS 20TB / 30TB 完整 SKU：[填写原文；未出现则记“未采集到”]
执行脚本版本 test.version：[填写]
最近测试时间 test.updatedAt：[填写]
逐行源 ID、实际目标、次数、备用状态 test.matchedFrom：[填写 {id, to, count, fallback}]
最近执行的 2TB 目标 test.target：[填写实际保存值；旧记录保留其原始目标 ID]
最近执行的目标来源 test.targetOrigin：[填写 user-specified / pattern-derived / legacy / 空值；保留旧来源]
三档总改写数 test.hitCount：[填写]
仅 2TB / Pro 优惠改写数 test.annualHitCount：[填写；兼容字段名，不证明年付扣款]
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
