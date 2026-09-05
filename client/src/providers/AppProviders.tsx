'use client';


import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider as NextThemesProvider } from "next-themes"

const AppProviders = ({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) => {
  return (
     <NextThemesProvider {...props}>
      <TooltipProvider>{children}</TooltipProvider>
    </NextThemesProvider>
  )
}

export default AppProviders