import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

interface PWAInstallButtonProps {
  variant?: 'dark' | 'light';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'dark' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const buttonClasses =
    variant === 'dark'
      ? 'inline-flex items-center gap-2 rounded-lg border border-white/25 bg-[#0A064D] px-4 py-2 text-xs font-medium text-white hover:border-[#E21E51] transition-colors whitespace-nowrap shrink-0'
      : 'inline-flex items-center gap-2 rounded-lg border border-[#DEDDEB] bg-white px-4 py-2 text-xs font-medium text-[#040037] hover:border-[#E21E51]/60 transition-colors whitespace-nowrap shrink-0 dark:border-[#2B276B] dark:bg-[#0D0952] dark:text-[#F8F9FA] dark:hover:border-[#E21E51]/60';

  if (isInstallable) {
    return (
      <button type="button" onClick={install} className={buttonClasses}>
        <Download className="h-3.5 w-3.5 text-[#E21E51] dark:text-[#FF85A5]" />
        <span>Install Mobile App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button type="button" onClick={() => setShowIOSGuide(true)} className={buttonClasses}>
          <Smartphone className="h-3.5 w-3.5 text-[#E21E51] dark:text-[#FF85A5]" />
          <span>Add to Home Screen</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#040037]/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-[#DEDDEB] bg-[#F8F9FA] p-6 text-[#040037] shadow-xl dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA]">
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-editorial text-2xl font-semibold">Install Winners Suites App</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close install guide"
                  className="rounded-lg p-1.5 text-[#514D7C] hover:bg-[#EFEFF5] dark:text-[#C5C2E3] dark:hover:bg-[#140F66]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ol className="mt-4 space-y-2.5 text-sm leading-relaxed text-[#514D7C] dark:text-[#DEDDEB]">
                <li>1. Tap the <strong>Share</strong> icon in your Safari browser bar.</li>
                <li>2. Scroll down and select <strong>Add to Home Screen</strong>.</li>
                <li>3. Open Winners Suites from your home screen for loyalty rewards and booking alerts.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full rounded-lg bg-[#E21E51] py-2.5 text-xs font-semibold text-white hover:bg-[#C81645] transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setShowIOSGuide(true)}
      className={buttonClasses}
    >
      <Smartphone className="h-3.5 w-3.5 text-[#E21E51] dark:text-[#FF85A5]" />
      <span>Mobile PWA Ready</span>
      {showIOSGuide && (
        <span className="sr-only">Open mobile installation instructions</span>
      )}
    </button>
  );
};
