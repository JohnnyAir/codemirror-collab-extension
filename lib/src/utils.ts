type DebouncedFunction<T extends (...args: any[]) => any> = (...args: Parameters<T>) => void

export function debounce<T extends (...args: any[]) => any>(func: T, delay: number): DebouncedFunction<T> {
  let timeoutId: number

  return function (...args: Parameters<T>) {
    clearTimeout(timeoutId)

    timeoutId = setTimeout(() => {
      //@ts-ignore
      func.apply(this, args)
    }, delay)
  }
}

export const noop = () => {}
