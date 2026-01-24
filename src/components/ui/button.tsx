import * as React from "react"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'link'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
    
    const variantStyles = {
      default: "bg-blue-600 text-white hover:bg-blue-700",
      outline: "border border-gray-300 bg-transparent hover:bg-gray-100",
      ghost: "bg-transparent hover:bg-gray-100",
      link: "text-blue-600 underline-offset-4 hover:underline bg-transparent"
    }

    return (
      <button
        className={`
          ${baseStyles} 
          ${variantStyles[variant]} 
          ${className || ''}
          h-10 px-4 py-2
        `}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }