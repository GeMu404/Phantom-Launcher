
import React from 'react';
import { Category } from '../types';
import { ASSETS } from '../constants';

interface SidebarProps {
  categories: Category[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onOpenManagement: () => void;
  taskbarMargin?: number;
  onResolveAsset: (path: string | undefined) => string;
  isSecretUnlocked?: boolean;
}

const Sidebar: React.FC<SidebarProps> = React.memo(({ categories, activeIndex, onSelect, onOpenManagement, taskbarMargin = 0, onResolveAsset, isSecretUnlocked = false }) => {
  const visibleCategories = categories.filter(c => c.enabled !== false && (c.id !== 'hidden' || isSecretUnlocked));
  const systemCategory = categories.find(c => c.id === 'all');
  const customConfigIcon = systemCategory?.configIcon || ASSETS.ui.config;

  return (
    <div
      className="sidebar-glass fixed left-0 top-0 h-full flex flex-col items-center z-50 bg-[#080808]/75 border-r border-white/5"
      style={{
        width: 'calc(50px + 1.5vh)',
        paddingBottom: `${taskbarMargin + 20}px`
      }}
    >
      <div
        className="flex-[2] flex flex-col items-center w-full relative overflow-hidden"
        style={{ paddingTop: 'calc(10px + 1vh)' }}
      >
        <div
          className="flex flex-col items-center gap-6 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            transform: `translateY(${(1 - visibleCategories.findIndex(c => categories.findIndex(orig => orig.id === c.id) === activeIndex)) * 64}px)`
          }}
        >
          {visibleCategories.map((cat, vIdx) => {
            const actualIdx = categories.findIndex(c => c.id === cat.id);
            const isActive = actualIdx === activeIndex;

            return (
              <div
                key={cat.id}
                onClick={() => onSelect(actualIdx)}
                className={`
                  relative cursor-pointer flex-shrink-0 flex items-center justify-center transition-[transform,opacity] duration-300 p-1
                  ${isActive ? 'scale-110' : 'opacity-80 hover:opacity-100 hover:scale-105'}
                `}
                style={{ width: '40px', height: '40px' }}
              >
                <img
                  src={onResolveAsset(cat.icon || ASSETS.templates.icon, 64)}
                  alt={cat.name}
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (target.getAttribute('data-fallback') === 'true') return;
                    target.setAttribute('data-fallback', 'true');
                    target.src = ASSETS.templates.icon;
                  }}
                  className="w-full h-full object-contain transition-[filter] duration-300"
                  style={{
                    color: cat.color,
                    filter: isActive
                      ? `drop-shadow(0 0 1px ${cat.color})`
                      : `none`
                  }}
                />
                {isActive && (
                  <div
                    className="absolute -right-2 w-[2px] rounded-full"
                    style={{
                      backgroundColor: cat.color,
                      boxShadow: `0 0 10px 2px ${cat.color}`,
                      height: '60%'
                    }}
                  ></div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="w-full flex-1 flex-shrink-0 flex flex-col items-center pb-2 pointer-events-none relative overflow-hidden">
        <div className="relative flex-1 flex items-center justify-center overflow-visible w-full">
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
          {(() => {
            const name = categories[activeIndex]?.name || 'PHANTOM';
            const techText = `${name}`;
            const isLong = name.length > 10;
            return (
              <span
                className="absolute bottom-0 left-1/2 whitespace-nowrap font-['Press_Start_2P'] font-bold uppercase tracking-[0.2em] text-white/40 select-none"
                style={{
                  fontSize: isLong ? 'clamp(10px, 1.5vh, 20px)' : 'clamp(12px, 2.5vh, 32px)',
                  transform: 'rotate(-90deg)',
                  transformOrigin: '0 50%',
                  textShadow: `0 0 20px ${categories[activeIndex]?.color || '#fff'}88`,
                }}
              >
                {techText}
              </span>
            );
          })()}
          <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
        </div>
      </div>

      <div
        onClick={onOpenManagement}
        className="w-full border-t border-white/5 pt-2 flex flex-col items-center cursor-pointer group"
      >
        <div
          className="relative flex items-center justify-center p-1 opacity-40 group-hover:opacity-100 transition-opacity duration-300"
          style={{ width: 'calc(28px + 1vh)', height: 'calc(28px + 1vh)' }}
        >
          <img
            src={onResolveAsset(customConfigIcon)}
            alt="CORE_CONFIG"
            onError={(e) => {
              const target = e.currentTarget;
              if (target.getAttribute('data-fallback') === 'true') return;
              target.setAttribute('data-fallback', 'true');
              target.src = ASSETS.ui.config;
            }}
            className="w-full h-full object-contain brightness-0 invert opacity-60 group-hover:opacity-100 transition-opacity"
          />
        </div>
      </div>
    </div>
  );
});

export default Sidebar;
