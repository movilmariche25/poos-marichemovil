import type { SVGProps } from 'react';

export function AppLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      aria-label="Mariche Movil Logo"
      {...props}
    >
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{stopColor: '#007BFF', stopOpacity: 1}} />
          <stop offset="100%" style={{stopColor: '#00BFFF', stopOpacity: 1}} />
        </linearGradient>
        <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style={{stopColor: '#002952', stopOpacity: 1}} />
          <stop offset="50%" style={{stopColor: '#005A9E', stopOpacity: 1}} />
          <stop offset="100%" style={{stopColor: '#00BFFF', stopOpacity: 1}} />
        </linearGradient>
      </defs>
      <g fill="currentColor">
        <path 
            fill="url(#grad1)"
            d="M197.5,60.5l-64.8-37.4c-4.5-2.6-9.9-2.6-14.4,0L53.5,60.5c-4.5,2.6-7.2,7.4-7.2,12.5v74.8c0,5.1,2.7,9.9,7.2,12.5l64.8,37.4c4.5,2.6,9.9,2.6,14.4,0l64.8-37.4c4.5-2.6,7.2-7.4,7.2-12.5V73C204.7,67.9,202,63.1,197.5,60.5z" 
        />
        <path 
            fill="#002952"
            d="M176.4,70.5v115H79.6v-115H176.4 M181.4,65.5H74.6v125h106.7V65.5z"
        />
        <path 
            fill="#005A9E"
            d="M166.4,180.5H89.6V75.5h76.7V180.5z"
        />
        <path 
            fill="#FFFFFF"
            d="M156,84h-56c-1.1,0-2-0.9-2-2s0.9-2,2-2h56c1.1,0,2,0.9,2,2S157.1,84,156,84z"
        />
        <path 
            fill="#FFFFFF"
            d="M128,155.5c-15.2,0-27.5-12.3-27.5-27.5s12.3-27.5,27.5-27.5s27.5,12.3,27.5,27.5S143.2,155.5,128,155.5z M128,105.5c-12.4,0-22.5,10.1-22.5,22.5s10.1,22.5,22.5,22.5s22.5-10.1,22.5-22.5S140.4,105.5,128,105.5z"
        />
        <path 
            fill="#FFFFFF"
            d="M128,138c-5.5,0-10-4.5-10-10s4.5-10,10-10s10,4.5,10,10S133.5,138,128,138z M128,123c-2.8,0-5,2.2-5,5s2.2,5,5,5s5-2.2,5-5S130.8,123,128,123z"
        />
        <path
            fill="#FFFFFF"
            d="M181.4,116.5l-9.1-5.1l1.4-2.5l9.1,5.1L181.4,116.5z"
        />
        <path
            fill="#FFFFFF"
            d="M174.6,128.8h-4.3v-11.4c0-1.1-0.9-2-2-2h-11.4v-4.3h11.4c3.4,0,6.2,2.8,6.2,6.2V128.8z"
        />
        <circle fill="#FFFFFF" cx="166.4" cy="135" r="1.5" />
        <circle fill="#FFFFFF" cx="172.9" cy="135" r="1.5" />

      </g>
    </svg>
  );
}
