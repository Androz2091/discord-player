'use client';

import { cn } from '@/lib/cn';
import { DISCORD_ICON, DISCORD_INVITE } from '@/lib/constants';
import Link from 'next/link';
import { useState } from 'react';

function Icon() {
  const [loaded, setLoaded] = useState(true);

  if (loaded) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={DISCORD_ICON}
        alt="AndrozDev"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(false)}
        className="rounded-xl h-14 w-14"
        draggable={false}
      />
    );
  }

  return (
    <div className="bg-[#313338] rounded-xl h-14 w-14 flex justify-center items-center">
      <h1 className="text-[#dadde1] font-light text-xl">AD</h1>
    </div>
  );
}

function StatusIndicator({ online = false }: { online?: boolean }) {
  return (
    <svg
      className={cn(
        online ? 'fill-[#23a559]' : 'fill-[#b5bac1] dark:fill-[#4e5058]',
        'h-[0.6rem] w-[0.6rem]',
      )}
      strokeWidth="0"
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M256 23.05C127.5 23.05 23.05 127.5 23.05 256S127.5 488.9 256 488.9 488.9 384.5 488.9 256 384.5 23.05 256 23.05z"></path>
    </svg>
  );
}

export default function DiscordInvite() {
  return (
    <div className="bg-[#f2f3f5] dark:bg-[#2b2d31] p-4 rounded-sm select-none cursor-default space-y-2">
      <p className="text-[#4e5058] dark:text-[#b5bac1] uppercase text-xs font-semibold">
        Join our official support server
      </p>
      <div className="flex justify-between items-center gap-16">
        <div className="flex items-center gap-4">
          <Icon />
          <div className="text-left">
            <Link
              href={DISCORD_INVITE}
              target="_blank"
              rel="noopener noreferrer"
            >
              <h1 className="dark:text-white text-[#060607] font-normal hover:underline cursor-pointer">
                AndrozDev
              </h1>
            </Link>
            <div className="flex items-center justify-between gap-3 text-xs">
              <p className="text-[#80848e]">
                <span className="inline-flex">
                  <StatusIndicator online />
                </span>{' '}
                560 Online
              </p>
              <p className="text-[#80848e]">
                <span className="inline-flex">
                  <StatusIndicator />
                </span>{' '}
                3,632 Members
              </p>
            </div>
          </div>
        </div>
        <Link href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">
          <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background h-10 py-2 px-4 bg-[#248046] hover:bg-[#1a6334] text-[#e9ffec]">
            Join
          </button>
        </Link>
      </div>
    </div>
  );
}
