import { Title } from "@mantine/core";
import { Prism } from "@mantine/prism";
import { NPMIcon, PNPMIcon, YarnIcon } from "../../icons";

export function Installation() {
  return (
    <div>
        <Title>Installation</Title>
        <Prism.Tabs defaultValue="yarn">
            <Prism.TabsList>
                <Prism.Tab value="yarn" icon={<YarnIcon />}>
                    yarn
                </Prism.Tab>
                <Prism.Tab value="pnpm" icon={<PNPMIcon />}>
                    pnpm
                </Prism.Tab>
                <Prism.Tab value="npm" icon={<NPMIcon />}>
                    npm
                </Prism.Tab>
            </Prism.TabsList>

            <Prism.Panel language="bash" value="yarn">
            yarn add discord-player @discord-player/extractor ytdl-core @discordjs/opus
            </Prism.Panel>

            <Prism.Panel language="bash" value="pnpm">
            pnpm add discord-player @discord-player/extractor ytdl-core @discordjs/opus
            </Prism.Panel>
            <Prism.Panel language="bash" value="npm">
            npm install discord-player @discord-player/extractor ytdl-core @discordjs/opus
            </Prism.Panel>
        </Prism.Tabs>
    </div>
  );
}
