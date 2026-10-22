// Нарисованные аватары учеников (иллюстрации, не UI-иконки) — один спрайт на страницу,
// дальше `<use href="#sl-av-…">` из WindowParts/HowSection.
export function AvatarSprite() {
   return (
      <svg width='0' height='0' style={{ position: 'absolute' }} aria-hidden='true' focusable='false'>
         <defs>
            <symbol id='sl-av-anna' viewBox='0 0 40 40'>
               <rect width='40' height='40' fill='#d9d2ff' />
               <path d='M7 40c1-8 6-11 13-11s12 3 13 11z' fill='#5b4df0' />
               <path
                  d='M10.5 22c-1.2-9.5 3-15 9.5-15s10.700 5.500 9.500 15c-.2 5 .8 8 2 10-4.200 1-7-1-8-4h-7c-1 3-3.800 5-8 4 1.200-2 2.200-5 2-10z'
                  fill='#3a2a52'
               />
               <rect x='17.500' y='24' width='5' height='6' rx='2' fill='#f1c1a0' />
               <ellipse cx='20' cy='19.500' rx='7' ry='8' fill='#f6cfb2' />
               <path d='M12.500 18c3.500 0 6.500-2.500 9-6 2 2.800 4 4.500 6 6 .5-7-2.500-10.500-7.500-10.500S12 11 12.500 18z' fill='#3a2a52' />
               <circle cx='17' cy='20' r='.95' fill='#2a1f3d' />
               <circle cx='23' cy='20' r='.95' fill='#2a1f3d' />
               <path d='M17.500 23.500c1.500 1.400 3.500 1.400 5 0' fill='none' stroke='#b5503e' strokeWidth='1.200' strokeLinecap='round' />
            </symbol>
            <symbol id='sl-av-ilya' viewBox='0 0 40 40'>
               <rect width='40' height='40' fill='#ffd9c2' />
               <path d='M7 40c1-8 6-11 13-11s12 3 13 11z' fill='#1f9d8a' />
               <rect x='17.500' y='24' width='5' height='6' rx='2' fill='#dba27c' />
               <ellipse cx='20' cy='19.500' rx='7' ry='8' fill='#e8b48f' />
               <path d='M12.800 18.500c-1-7 2-11.500 7.200-11.500s8.200 4.500 7.200 11.500c-1.200-3.500-3.500-5.500-7.200-5.500s-6 2-7.200 5.500z' fill='#1d1a2b' />
               <circle cx='16.500' cy='20' r='2.700' fill='none' stroke='#1d1a2b' strokeWidth='1.100' />
               <circle cx='23.500' cy='20' r='2.700' fill='none' stroke='#1d1a2b' strokeWidth='1.100' />
               <path d='M19.200 19.800h1.600' stroke='#1d1a2b' strokeWidth='1.100' />
               <circle cx='16.500' cy='20' r='.8' fill='#1d1a2b' />
               <circle cx='23.500' cy='20' r='.8' fill='#1d1a2b' />
               <path d='M17.800 24.800c1.200.9 3.200.9 4.400 0' fill='none' stroke='#a14a35' strokeWidth='1.200' strokeLinecap='round' />
            </symbol>
            <symbol id='sl-av-maria' viewBox='0 0 40 40'>
               <rect width='40' height='40' fill='#c7f0df' />
               <path d='M7 40c1-8 6-11 13-11s12 3 13 11z' fill='#f0a93b' />
               <circle cx='20' cy='7.500' r='4.200' fill='#b4532a' />
               <rect x='17.500' y='24' width='5' height='6' rx='2' fill='#f1c4a6' />
               <ellipse cx='20' cy='19.500' rx='7' ry='8' fill='#f6d2b8' />
               <path d='M12.800 19c-.8-7 2.200-10.500 7.200-10.500s8 3.500 7.200 10.500c-1.500-4.500-4-6.500-7.200-6.500s-5.700 2-7.200 6.500z' fill='#b4532a' />
               <circle cx='17' cy='20.500' r='.95' fill='#2a1f3d' />
               <circle cx='23' cy='20.500' r='.95' fill='#2a1f3d' />
               <path d='M17.500 24c1.500 1.400 3.500 1.400 5 0' fill='none' stroke='#c2543f' strokeWidth='1.200' strokeLinecap='round' />
               <circle cx='14.800' cy='23' r='1.300' fill='#f2a58f' opacity='.55' />
               <circle cx='25.200' cy='23' r='1.300' fill='#f2a58f' opacity='.55' />
            </symbol>
            <symbol id='sl-av-kirill' viewBox='0 0 40 40'>
               <rect width='40' height='40' fill='#ffe9a8' />
               <path d='M7 40c1-8 6-11 13-11s12 3 13 11z' fill='#e2557a' />
               <g fill='#c98d2b'>
                  <circle cx='13.500' cy='12.500' r='4.200' />
                  <circle cx='20' cy='9.500' r='4.800' />
                  <circle cx='26.500' cy='12.500' r='4.200' />
                  <circle cx='12' cy='17' r='3' />
                  <circle cx='28' cy='17' r='3' />
               </g>
               <rect x='17.500' y='24' width='5' height='6' rx='2' fill='#e5b08e' />
               <ellipse cx='20' cy='20' rx='7' ry='7.800' fill='#f0c3a0' />
               <g fill='#c98d2b'>
                  <circle cx='15.500' cy='13.800' r='2.600' />
                  <circle cx='20' cy='12.600' r='2.800' />
                  <circle cx='24.500' cy='13.800' r='2.600' />
               </g>
               <circle cx='17' cy='20.500' r='.95' fill='#2a1f3d' />
               <circle cx='23' cy='20.500' r='.95' fill='#2a1f3d' />
               <path d='M17.200 24.200c1.700 1.600 3.900 1.600 5.600 0' fill='none' stroke='#a5442f' strokeWidth='1.200' strokeLinecap='round' />
            </symbol>
         </defs>
      </svg>
   )
}
