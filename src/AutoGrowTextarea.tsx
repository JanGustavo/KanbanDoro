import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ChangeEventHandler,
  type TextareaHTMLAttributes,
} from 'react';

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> & {
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
  value: string;
};

export default function AutoGrowTextarea({ onChange, rows = 1, value, ...props }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    resize();
  }, [resize, value]);
  useEffect(() => {
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [resize]);

  return (
    <textarea
      {...props}
      ref={ref}
      rows={rows}
      value={value}
      onChange={event => {
        onChange(event);
        resize();
      }}
    />
  );
}
