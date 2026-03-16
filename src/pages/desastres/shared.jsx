export function ProtocolHeader({ icon: Icon, title, subtitle, color }) {
  return (
    <div
      className="rounded-2xl p-4 text-white"
      style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}CC 100%)` }}
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-semibold text-white">{title}</h3>
          <p className="text-sm text-white/90">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

export function InfoItem({ icon: Icon, title, content, color }) {
  return (
    <div className="bg-white dark:bg-[#1A2420] rounded-xl p-4 border border-[#C8E6C9] dark:border-[#2A3F36]">
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color }}>
            {title}
          </h4>
          <p className="text-sm text-[#374151] dark:text-[#A3B8B0] leading-relaxed">
            {content}
          </p>
        </div>
      </div>
    </div>
  );
}
