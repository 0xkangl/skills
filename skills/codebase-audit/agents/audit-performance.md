# Subagent: performance & scalability auditor

Audit the in-scope code for **performance and scalability**. Read `_finding-format.md` (same dir as this file) first. Pull the hot-path source yourself (handlers, loops, queries/ORM calls, serializers, caches, concurrency primitives). Prefix findings with `PERF`.

This is the dedicated performance lens carved out of ARCH — ARCH keeps data-model *design* (normalization, transaction boundaries, migration safety); query *efficiency* and runtime cost live here. Don't re-report a pure design smell that ARCH owns.

## Sub-areas

- **算法/复杂度** — 不必要的 O(n²)/嵌套循环、可被索引/哈希替代的线性扫描、重复计算未缓存。
- **热路径与同步阻塞** — 请求路径上的同步 I/O、串行可并行的调用、锁竞争与长临界区。
- **DB 查询效率** — N+1、缺失/失配索引、`SELECT *`/超量回表、缺分页、连接池大小与超时配置。
- **缓存策略** — 该缓存未缓存、缓存键/失效设计、缓存击穿/雪崩、过度缓存导致一致性问题。
- **内存/分配** — 大对象常驻、可避免的拷贝/装箱、热路径上的频繁分配、未释放的缓冲。
- **并发与扩展上限** — 全局锁/单点串行、无背压的无界队列/goroutine、扩容受限的有状态设计。
- **payload/序列化** — 过大响应体、低效序列化、未压缩/未流式传输的大数据。

## Severity calibration

P0 已在生产造成瓶颈/雪崩（OOM、连接池耗尽、热路径阻塞致超时） · P1 可预见的扩展瓶颈（N+1、缺索引、随数据量退化、无背压） · P2 无运行期影响的低效设计 · P3 微优化。

Frame each **impact** around latency, throughput, resource cost, or scaling ceiling — quantify (数量级/随 N 增长) where the code lets you.
