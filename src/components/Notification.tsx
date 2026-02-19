
import React, { useEffect, useState } from 'react';
import anime from 'animejs';

interface NotificationProps {
  message: string | null;
  color: string;
}

const Notification: React.FC<NotificationProps> = ({ message, color }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setVisible(true);
      (anime as any)({
        targets: '#notif-wrapper',
        translateY: [30, 0],
        opacity: [0, 1],
        duration: 400,
        easing: 'easeOutExpo'
      });
    } else {
      setVisible(false);
    }
  }, [message]);

  if (!message || !visible) return null;

  // Consistent Cyber Clip: Diagonal cut on top-right ONLY.
  const CLIP_PATH = `polygon(0% 0%, calc(100% - 15px) 0%, 100% 15px, 100% 100%, 0% 100%)`;

  return (
    <div className="fixed bottom-[13vh] left-1/2 -translate-x-1/2 z-[999] pointer-events-none flex flex-col items-center">
      <div
        id="notif-wrapper"
        className="relative min-w-[340px]"
        style={{
          filter: `drop-shadow(0 0 20px ${color}55)`
        }}
      >
        {/* OUTLINE LAYER: This acts as the border */}
        <div
          style={{
            clipPath: CLIP_PATH,
            backgroundColor: color,
            padding: '2px', // Enforced 2px border thickness
            opacity: 1
          }}
        >
          {/* CONTENT LAYER */}
          <div
            className="bg-[#0c0c0c]/98"
            style={{
              clipPath: CLIP_PATH, // Must same clip-path to follow the outline
              padding: '18px 24px'
            }}
          >
            <div className="flex flex-col gap-2">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rotate-45" style={{ backgroundColor: color }}></div>
                  <span className="text-[7.5px] font-black uppercase tracking-[0.4em] text-white/40 font-mono">
                    SYSTEM_LINK.ACCESS
                  </span>
                </div>
                <div className="flex gap-1 items-center opacity-30 grayscale">
                  <div className="w-0.5 h-0.5 bg-white/50"></div>
                  <div className="w-0.5 h-0.5 bg-white/50"></div>
                  <div className="w-2 h-0.5" style={{ backgroundColor: color }}></div>
                </div>
              </div>

              {/* Message Body */}
              <div className="flex flex-col mt-1">
                <h2 className="text-[14px] font-bold text-white uppercase tracking-[0.02em] leading-tight">
                  {message.includes('::') ? message.split('::')[1] : message}
                </h2>

                <div className="flex items-center gap-2 mt-2">
                  <span className="px-1 py-[1px] bg-white/5 border-2 border-white/10 text-[6px] text-white/50 uppercase font-mono tracking-widest">
                    {message.includes('::') ? message.split('::')[0] : 'NODE_ACTION'}
                  </span>
                  <div className="flex items-center gap-1 opacity-20">
                    <span className="w-3 h-[1px] bg-white/20"></span>
                    <span className="text-[5px] text-white uppercase font-mono">Sync_Success</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Notification;
