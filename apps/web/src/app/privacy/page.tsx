import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "使用与隐私说明 | AetherTarot",
  description: "AetherTarot 免费内测期间的使用边界、数据处理方式与隐私说明。",
};

const retentionItems = [
  ["登录与解读运行记录", "通常保留 30 天"],
  ["反馈与运营归因记录", "通常保留 90 天"],
  ["登录用户保存的完整解读", "通常保留 365 天"],
  ["未完成 Final 的临时服务端 snapshot", "通常保留至 7 天；完成后立即消费"],
  ["游客浏览器历史与手记", "保留在当前浏览器，直至你清除本站数据"],
  ["同一解读线程的摘要记忆", "通常保留 90 天"],
  ["已结算 Token 与配额审计记录", "通常保留 7 天"],
] as const;

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-[760px] px-6 pb-20 pt-12 sm:px-8 sm:pt-16">
      <article className="font-sans text-text-body">
        <header className="border-b border-paper-border pb-8">
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            使用与隐私说明
          </h1>
          <p className="mt-4 max-w-[68ch] text-sm leading-7 text-text-muted">
            更新日期：2026 年 8 月 10 日。本说明适用于 AetherTarot 免费内测网站。
            请在登录、提交问题或反馈前阅读；如果你不同意这些处理方式，请不要提交相关内容。
          </p>
        </header>

        <div className="space-y-12 py-10 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-ink [&_p]:mt-4 [&_p]:leading-8">
          <section aria-labelledby="service-boundary">
            <h2 id="service-boundary">这是反思工具，不是确定性预言</h2>
            <p>
              AetherTarot 用塔罗象征帮助你整理问题、观察假设并形成可验证的行动线索。
              解读不保证未来结果，也不替代医疗、心理、法律、财务或其他专业服务。
              涉及人身安全、健康或重大现实决定时，请优先依据现实证据并寻求合格支持。
            </p>
          </section>

          <section aria-labelledby="data-collected">
            <h2 id="data-collected">会处理哪些信息</h2>
            <ul className="mt-5 list-disc space-y-3 pl-5 leading-7 marker:text-terracotta">
              <li>
                <strong className="font-semibold text-ink">账号与安全信息：</strong>
                登录邮箱、不可逆密码哈希、登录会话，以及用于防刷和安全审计的加盐 IP 哈希。
                系统不保存明文密码或明文 IP。
              </li>
              <li>
                <strong className="font-semibold text-ink">解读信息：</strong>
                你提交的问题、牌阵与抽牌结果、模型生成的解读、追问回答，以及你主动填写的手记。
                登录用户的完整解读会用于历史回看；游客历史与手记只保存在当前浏览器的独立游客空间，不会自动导入登录账号。两阶段解读在等待追问期间会在服务端保存有期限的临时 snapshot；安全拦截不会消费它，方便你修改后重试，也不会把被拦截答案写入长期画像。
              </li>
              <li>
                <strong className="font-semibold text-ink">反馈信息：</strong>
                你选择的反馈标签、可选补充说明，以及是否同意把去标识化内容用于内部质量评估。
                该授权默认关闭，不影响提交普通反馈。
              </li>
              <li>
                <strong className="font-semibold text-ink">运营与用量信息：</strong>
                随机会话或流程标识、访问路径、清洗后的 UTM 参数、来源网站域名、请求状态、耗时与 Token 用量。
                运营事件不保存完整访问 URL、完整来源地址、问题正文或解读正文。
              </li>
            </ul>
          </section>

          <section aria-labelledby="processing-purpose">
            <h2 id="processing-purpose">为什么处理这些信息</h2>
            <p>
              这些信息仅用于提供登录与解读、保存用户主动选择的历史、执行每日额度与防刷、
              处理反馈、排查服务故障，以及统计内测来源和转化。我们不会把这些信息出售给第三方，
              也不会用它建立与本服务无关的长期用户画像。
            </p>
          </section>

          <section aria-labelledby="model-processing">
            <h2 id="model-processing">模型与服务提供方</h2>
            <p>
              生成解读或百科回答时，问题、牌阵、抽牌结果和完成生成所需的有限上下文会发送给模型服务提供方；
              账号密码不会发送给模型。数据库与基础设施服务提供方会在提供托管、备份和安全能力所必需的范围内处理数据。
              请不要在问题、追问、反馈或手记中填写真实姓名、证件号码、联系方式、账号密码，或不必要的健康和财务隐私。
            </p>
          </section>

          <section aria-labelledby="retention-periods">
            <h2 id="retention-periods">保存多久</h2>
            <dl className="mt-6 divide-y divide-paper-border border-y border-paper-border">
              {retentionItems.map(([label, value]) => (
                <div key={label} className="grid gap-1 py-4 sm:grid-cols-[1fr_auto] sm:gap-8">
                  <dt className="font-medium text-ink">{label}</dt>
                  <dd className="text-sm text-text-muted">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-text-muted">
              未提交问题草稿按身份分区：游客草稿保存在当前浏览器 localStorage，账号草稿只保存在当前标签页 sessionStorage，并在账号切换时清除；旧全局草稿不会自动导入。游客历史与最近一次 UTM 归因不由服务器清理任务删除。账号历史同步失败时，completed reading 会暂存在按账号隔离的浏览器待同步队列，成功同步后删除；它不会导入其他账号或作为长期画像。
              UTM 归因在浏览器中最多保留 30 天。
            </p>
          </section>

          <section aria-labelledby="your-controls">
            <h2 id="your-controls">你的选择与请求</h2>
            <p>
              你可以不填写可选反馈备注、不授权内部质量回放，也可以在浏览器设置中清除 aethertarot.cn 的网站数据，从而删除本机游客历史、手记、问题草稿和账号待同步队列；这不会删除已经同步的账号服务端历史。账号服务端数据需按下述渠道请求删除。
              如需查询、更正或删除服务器中与你有关的内测数据，请通过收到内测邀请的原渠道联系项目运营方，
              并提供登录邮箱或相关解读 ID 以便核验。游客数据仅以哈希标识关联，无法可靠核验归属时可能无法定位或单独删除。
            </p>
          </section>

          <section aria-labelledby="beta-change">
            <h2 id="beta-change">内测变更</h2>
            <p>
              本站目前为免费内测，每日使用次数有限。若数据类别、用途、共享范围或保留期发生实质变化，
              我们会更新本页面和日期；需要另行授权的处理不会沿用旧授权。
            </p>
          </section>
        </div>

        <footer className="border-t border-paper-border pt-8">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-sm font-medium text-terracotta-ink underline decoration-paper-border underline-offset-4 transition-colors hover:text-terracotta"
          >
            返回首页
          </Link>
        </footer>
      </article>
    </main>
  );
}
