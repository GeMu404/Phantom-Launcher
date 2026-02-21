
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
            className="bg-[#0c0c0c]/98 flex items-center justify-center text-center"
            style={{
              clipPath: CLIP_PATH,
              padding: '24px 40px',
              minHeight: '80px'
            }}
          >
            <h2
              className="font-bold text-white uppercase tracking-wider leading-tight transition-all duration-300"
              style={{
                fontSize: message.length > 25 ? '10px' : message.length > 15 ? '12px' : '15px'
              }}
            >
              {message.includes('::') ? message.split('::')[1] : message}
            </h2>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Notification;
