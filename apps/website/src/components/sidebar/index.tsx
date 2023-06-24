import { SheetContent, SheetTrigger } from '@edge-ui/react';
import { PanelRightClose, Sheet } from 'lucide-react';

export function Sidebar() {
    return (
        <Sheet>
            <SheetTrigger>
                <PanelRightClose className="h-8 w-8" />
            </SheetTrigger>
            <SheetContent side="left">
                <nav className="flex flex-col justify-start space-y-6 text-sm font-medium">
                    <p>One</p>
                    <p>Two</p>
                    <p>Three</p>
                    <p>Four</p>
                    <p>Five</p>
                    <p>Six</p>
                </nav>
            </SheetContent>
        </Sheet>
    );
}
