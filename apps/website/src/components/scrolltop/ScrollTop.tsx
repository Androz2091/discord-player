import { useEffect, useRef } from 'react';
import { VscArrowUp } from 'react-icons/vsc';

export function ScrollTop() {
    const scrollTopRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const listener = () => {
            if (document.body.scrollTop > 500 || document.documentElement.scrollTop > 500) {
                if (scrollTopRef.current) {
                    scrollTopRef.current.style.display = 'block';
                }
            } else {
                if (scrollTopRef.current) {
                    scrollTopRef.current.style.display = 'none';
                }
            }
        };

        window.addEventListener('scroll', listener);

        return () => {
            window.removeEventListener('scroll', listener);
        };
    }, []);

    return (
        <button
            onClick={() => {
                window.scrollTo({
                    top: 0,
                    left: 0,
                    behavior: 'smooth'
                });
            }}
            className="fixed bottom-[20px] right-[30px] z-[99] hidden cursor-pointer rounded-lg bg-teal-500 p-3 text-white transition-all duration-[180] ease-in-out hover:translate-y-[-25%] hover:bg-teal-700"
            ref={scrollTopRef}
        >
            <span className="sr-only">Scroll to Top</span>
            <VscArrowUp className="h-5 w-5" />
        </button>
    );
}
