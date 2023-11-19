import { Container } from '@/components/layout/Container';
import { useEffect, useState } from 'react';
import { Loader, ScrollArea, Sheet, SheetContent, SheetTrigger } from '@edge-ui/react';
import { PanelRightClose } from 'lucide-react';
import { DocsItemList } from '@/components/docs/DocsItemList';
import { Combobox } from '@/components/combobox';
import { useRouter } from 'next/router';
import { ContentArea } from '@/components/docs/ContentArea';
import { VscSymbolClass, VscSymbolInterface, VscSymbolMethod } from 'react-icons/vsc';
import { DocumentationStore } from '@/lib/store';

export default function DocsPage() {
    const router = useRouter();
    const { package: pkg, type, target } = router.query;
    const { libNames, libraries } = DocumentationStore;
    const [currentLib, setCurrentLib] = useState<(typeof libraries)[0]>();

    useEffect(() => {
        if (!pkg || !type || !target) return;

        if (pkg === currentLib?.name) return;

        const lib = libraries.find((libr) => libr.name === pkg);
        if (!lib) return;

        setCurrentLib(lib);
    }, [pkg, type, target]);

    if (!currentLib) {
        return (
            <Container>
                <div className="grid place-items-center h-[80vh]">
                    <Loader variant="bubble" className="h-16 w-16" />
                </div>
            </Container>
        );
    }

    const selectList = (
        <Combobox
            onSelect={(val) => {
                const lib = libraries.find((libr) => libr.name === val)!;
                if (!lib) return;
                const navigationConfig = {
                    type: lib.classes.length ? 'class' : lib.functions.length ? 'function' : lib.types.length ? 'type' : '',
                    target: lib.classes.length ? lib.classes[0].data.name : lib.functions.length ? lib.functions[0].data.name : lib.types.length ? lib.types[0].data.name : ''
                };

                router.push(`/docs/${encodeURIComponent(lib.name)}/${encodeURIComponent(navigationConfig.type)}/${encodeURIComponent(navigationConfig.target)}`);
            }}
            value={currentLib.name}
            options={libNames.map((l) => ({ label: l, value: l }))}
        />
    );

    return (
        <Container>
            <div className="flex flex-row items-start w-full gap-5 mt-2">
                <div className="lg:border lg:p-2 rounded-lg lg:w-[20%] mb-5 gap-5">
                    <div className="hidden lg:flex flex-col gap-5 mt-5">
                        {selectList}
                        <ScrollArea className="max-h-screen">
                            <div className="space-y-3 max-h-[84vh]">
                                {currentLib.classes.length ? (
                                    <DocsItemList
                                        name="Classes"
                                        data={currentLib.classes.map((m) => {
                                            return {
                                                lib: currentLib.name,
                                                name: m.data.name,
                                                type: 'class'
                                            };
                                        })}
                                        link={(name) => {
                                            return `/docs/${encodeURIComponent(currentLib.name)}/class/${name}`;
                                        }}
                                        icon={<VscSymbolClass className="h-5 w-5" />}
                                    />
                                ) : null}
                                {currentLib.functions.length ? (
                                    <DocsItemList
                                        name="Functions"
                                        data={currentLib.functions.map((m) => {
                                            return {
                                                lib: currentLib.name,
                                                name: m.data.name,
                                                type: 'function'
                                            };
                                        })}
                                        link={(name) => {
                                            return `/docs/${encodeURIComponent(currentLib.name)}/function/${name}`;
                                        }}
                                        icon={<VscSymbolMethod className="h-5 w-5" />}
                                    />
                                ) : null}
                                {currentLib.types.length ? (
                                    <DocsItemList
                                        name="Typedef"
                                        data={currentLib.types.map((m) => {
                                            return {
                                                lib: currentLib.name,
                                                name: m.data.name,
                                                type: 'type'
                                            };
                                        })}
                                        link={(name) => {
                                            return `/docs/${encodeURIComponent(currentLib.name)}/type/${name}`;
                                        }}
                                        icon={<VscSymbolInterface className="h-5 w-5" />}
                                    />
                                ) : null}
                            </div>
                        </ScrollArea>
                    </div>
                    <div className="lg:hidden absolute left-0 top-[4.3rem]">
                        <Sheet>
                            <SheetTrigger className="sticky">
                                <PanelRightClose className="h-8 w-8" />
                            </SheetTrigger>
                            <SheetContent side="left" className="w-[85%]">
                                <div className="flex flex-col gap-5 mt-5">
                                    {selectList}
                                    <ScrollArea className="max-h-screen">
                                        <div className="space-y-3 max-h-[84vh]">
                                            {currentLib.classes.length ? (
                                                <DocsItemList
                                                    name="Classes"
                                                    data={currentLib.classes.map((m) => {
                                                        return {
                                                            lib: currentLib.name,
                                                            name: m.data.name,
                                                            type: 'class'
                                                        };
                                                    })}
                                                    link={(name) => {
                                                        return `/docs/${encodeURIComponent(currentLib.name)}/class/${name}`;
                                                    }}
                                                    icon={<VscSymbolClass className="h-5 w-5" />}
                                                />
                                            ) : null}
                                            {currentLib.functions.length ? (
                                                <DocsItemList
                                                    name="Functions"
                                                    data={currentLib.functions.map((m) => {
                                                        return {
                                                            lib: currentLib.name,
                                                            name: m.data.name,
                                                            type: 'function'
                                                        };
                                                    })}
                                                    link={(name) => {
                                                        return `/docs/${encodeURIComponent(currentLib.name)}/function/${name}`;
                                                    }}
                                                    icon={<VscSymbolMethod className="h-5 w-5" />}
                                                />
                                            ) : null}
                                            {currentLib.types.length ? (
                                                <DocsItemList
                                                    name="Typedef"
                                                    data={currentLib.types.map((m) => {
                                                        return {
                                                            lib: currentLib.name,
                                                            name: m.data.name,
                                                            type: 'type'
                                                        };
                                                    })}
                                                    link={(name) => {
                                                        return `/docs/${encodeURIComponent(currentLib.name)}/type/${name}`;
                                                    }}
                                                    icon={<VscSymbolInterface className="h-5 w-5" />}
                                                />
                                            ) : null}
                                        </div>
                                    </ScrollArea>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                </div>
                <div className="flex-1 overflow-auto h-screen hidescrollbar">
                    <ContentArea data={currentLib} />
                </div>
            </div>
        </Container>
    );
}
