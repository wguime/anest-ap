import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/design-system'
import { Search, ChevronDown, X, LayoutGrid, List } from 'lucide-react'
import { cn } from '@/design-system/utils/tokens'

/**
 * FilterBar - Universal filter bar component for management module
 *
 * @param {string} searchPlaceholder - Placeholder text for search input
 * @param {string} searchValue - Current search input value
 * @param {function} onSearchChange - Callback when search value changes
 * @param {Array} filters - Array of filter configs: { id, label, options: [{ value, label }] }
 * @param {Object} filterValues - Object with filter values keyed by filter id
 * @param {function} onFilterChange - Callback when filter changes: (filterId, value) => void
 * @param {Object} actionButton - Optional action button config: { label, icon, onClick, variant }
 */
function FilterBar({
  searchPlaceholder = 'Buscar...',
  searchValue = '',
  onSearchChange,
  filters = [],
  filterValues = {},
  onFilterChange,
  actionButton,
  viewMode,
  onViewModeChange,
  className
}) {
  const [openDropdown, setOpenDropdown] = useState(null)
  const dropdownRefs = useRef({})

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (openDropdown && dropdownRefs.current[openDropdown]) {
        if (!dropdownRefs.current[openDropdown].contains(event.target)) {
          setOpenDropdown(null)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openDropdown])

  const handleFilterSelect = (filterId, value) => {
    onFilterChange?.(filterId, value)
    setOpenDropdown(null)
  }

  const clearSearch = () => {
    onSearchChange?.('')
  }

  const getSelectedLabel = (filter) => {
    const selectedValue = filterValues[filter.id]
    if (!selectedValue || selectedValue === 'all') {
      return filter.label
    }
    const option = filter.options.find(opt => opt.value === selectedValue)
    return option?.label || filter.label
  }

  return (
    <div className={cn(
      'flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4',
      'bg-card rounded-2xl shadow-sm',
      'border border-border',
      className
    )}>
      {/* Search Input */}
      <div className="relative flex-1 min-w-[200px]">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"
        />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder={searchPlaceholder}
          className={cn(
            'w-full pl-10 pr-10 py-2.5 rounded-xl',
            'bg-gray-50 dark:bg-[#0D1512]',
            'border border-border',
            'text-gray-900 dark:text-white',
            'placeholder:text-muted-foreground dark:placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
            'transition-all duration-200'
          )}
        />
        {searchValue && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Filter Dropdowns */}
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((filter) => (
          <div
            key={filter.id}
            ref={(el) => (dropdownRefs.current[filter.id] = el)}
            className="relative"
          >
            <button
              onClick={() => setOpenDropdown(openDropdown === filter.id ? null : filter.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl',
                'bg-gray-50 dark:bg-[#0D1512]',
                'border border-border',
                'text-sm font-medium',
                filterValues[filter.id] && filterValues[filter.id] !== 'all'
                  ? 'text-primary'
                  : 'text-muted-foreground',
                'hover:border-primary hover:bg-gray-100 dark:hover:bg-card',
                'focus:outline-none focus:ring-2 focus:ring-primary/50',
                'transition-all duration-200',
                openDropdown === filter.id && 'ring-2 ring-primary/50 border-primary'
              )}
            >
              <span className="whitespace-nowrap">{getSelectedLabel(filter)}</span>
              <ChevronDown
                className={cn(
                  'w-4 h-4 transition-transform duration-200',
                  openDropdown === filter.id && 'rotate-180'
                )}
              />
            </button>

            {/* Dropdown Menu */}
            {openDropdown === filter.id && (
              <div className={cn(
                'absolute top-full left-0 mt-2 min-w-[180px] z-50',
                'bg-card rounded-xl shadow-lg',
                'border border-border',
                'py-1 overflow-hidden',
                'animate-in fade-in-0 zoom-in-95 duration-200'
              )}>
                {filter.options.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleFilterSelect(filter.id, option.value)}
                    className={cn(
                      'w-full px-4 py-2 text-left text-sm',
                      'hover:bg-gray-50 dark:hover:bg-[#0D1512]',
                      'transition-colors duration-150',
                      filterValues[filter.id] === option.value
                        ? 'text-primary bg-primary/5 dark:bg-primary/10 font-medium'
                        : 'text-gray-700 dark:text-gray-300'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* View Mode Toggle */}
        {viewMode && onViewModeChange && (
          <div className="flex items-center bg-gray-100 dark:bg-[#0D1512] rounded-xl border border-border p-0.5">
            <button
              type="button"
              onClick={() => onViewModeChange('card')}
              className={cn(
                'p-2 rounded-lg transition-all duration-200',
                viewMode === 'card'
                  ? 'bg-card text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-gray-900 dark:hover:text-white'
              )}
              title="Visualizar em cards"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('list')}
              className={cn(
                'p-2 rounded-lg transition-all duration-200',
                viewMode === 'list'
                  ? 'bg-card text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-gray-900 dark:hover:text-white'
              )}
              title="Visualizar em lista"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Action Button */}
        {actionButton && (
          <Button
            onClick={actionButton.onClick}
            variant={actionButton.variant || 'default'}
            className={cn(
              'ml-auto flex items-center gap-2',
              'bg-primary hover:bg-[#005730] text-white',
              'rounded-xl px-4 py-2.5',
              'focus:ring-2 focus:ring-primary/50',
              'transition-all duration-200'
            )}
          >
            {actionButton.icon && <actionButton.icon className="w-4 h-4" />}
            <span>{actionButton.label}</span>
          </Button>
        )}
      </div>
    </div>
  )
}

export default FilterBar
