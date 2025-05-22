import PropTypes from 'prop-types'
import { cn } from "@/lib/utils"
import { badgeVariants } from './variants'

function Badge({
  className = '',  // Using default parameter instead of defaultProps
  variant = 'default', // Using default parameter instead of defaultProps
  ...props
}) {
  return (
    <div 
      className={cn(badgeVariants({ variant }), className)} 
      {...props} 
    />
  )
}

Badge.propTypes = {
  className: PropTypes.string,
  variant: PropTypes.oneOf(['default', 'secondary', 'destructive', 'outline'])
}

// Remove Badge.defaultProps

export { Badge }