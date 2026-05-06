'use client'

/**
 * Print Footer Component
 * 
 * Renders consistent footer across all print documents.
 */

interface PrintFooterProps {
  confidentialityLevel?: 'green' | 'yellow' | 'red'
  customText?: string
  showPageNumber?: boolean
  pageNumber?: number
  totalPages?: number
  className?: string
}

export function PrintFooter({
  confidentialityLevel = 'green',
  customText,
  showPageNumber = true,
  pageNumber,
  totalPages,
  className = '',
}: PrintFooterProps) {
  const confidentialityText = {
    green: 'Caterpillar: Confidential Green',
    yellow: 'Caterpillar: Confidential Yellow',
    red: 'Caterpillar: Confidential Red',
  }
  
  const confidentialityColors = {
    green: 'text-green-600',
    yellow: 'text-yellow-600',
    red: 'text-red-600',
  }
  
  return (
    <div className={`print-footer flex items-center justify-between text-xs py-2 border-t mt-auto ${className}`}>
      {/* Confidentiality */}
      <div className={`font-medium ${confidentialityColors[confidentialityLevel]}`}>
        {customText || confidentialityText[confidentialityLevel]}
      </div>
      
      {/* Page Number */}
      {showPageNumber && pageNumber !== undefined && (
        <div className="text-muted-foreground">
          Page {pageNumber}{totalPages ? ` of ${totalPages}` : ''}
        </div>
      )}
    </div>
  )
}
