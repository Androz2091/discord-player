import ip from 'ip';

export class IPBlock {
    public usage = 0;
    public readonly cidr: string;
    public readonly cidrSize: number;

    public constructor(public block: string) {
        if (ip.isV4Format(block.split('/')[0]) && !block.includes('/')) {
            block += '/32';
        } else if (ip.isV6Format(block.split('/')[0]) && !block.includes('/')) {
            block += '/128';
        }

        this.cidr = ip.cidr(this.block);
        this.cidrSize = ip.cidrSubnet(this.block).subnetMaskLength;
    }

    public consume() {
        this.usage++;
    }
}

export interface IPRotationConfig {
    /**
     * IP blocks to use
     */
    blocks: string[];
    /**
     * IPs to exclude
     */
    exclude?: string[];
    /**
     * Max retries to find an IP that is not excluded
     */
    maxRetries?: number;
}

export class IPRotator {
    public blocks: IPBlock[] = [];
    public failures = new Map<string, number>();
    public MAX_NEXT_RETRIES = 30;
    #retries = 0;

    public constructor(public config: IPRotationConfig) {
        config.exclude ??= [];
        this.blocks = config.blocks.map((block) => new IPBlock(block));
        this.MAX_NEXT_RETRIES = config.maxRetries ?? 10;
    }

    public getIP(): { ip: string; family: 4 | 6 } {
        const block = this.blocks.sort((a, b) => a.usage - b.usage)[0];
        if (!block) {
            throw new Error('No IP blocks available');
        }

        const random = IPRotator.getRandomIP(block.cidr, block.cidrSize);

        if (this.isFailedOrExcluded(random)) {
            this.#retries++;

            if (this.#retries > this.MAX_NEXT_RETRIES) {
                this.#retries = 0;
                throw new Error('Unable to find an IP that is not excluded');
            }

            return this.getIP();
        }

        this.#retries = 0;
        block.consume();
        return { ip: random, family: ip.isV4Format(random) ? 4 : 6 };
    }

    public isFailedOrExcluded(ip: string) {
        return this.failures.has(ip) || !!this.config.exclude?.includes(ip);
    }

    public addFailed(ip: string) {
        const lastFailedCount = this.failures.get(ip) ?? 0;

        this.failures.set(ip, lastFailedCount + 1);
    }

    public static getRandomIP(address: string, start?: number, end?: number) {
        // Author: Jesse Tane <jesse.tane@gmail.com>
        // NPMJS: https://npmjs.org/random-ip

        const bytes = ip.toBuffer(address);
        const ipv6 = bytes.length === 16;
        const bytesize = 8;

        start = start || 0;
        end = typeof end !== 'undefined' ? end : bytes.length * bytesize;

        for (let i = 0; i < bytes.length; i++) {
            let bit = i * bytesize;

            if (bit + bytesize < start || bit >= end) {
                continue;
            }

            let b = bytes[i];

            for (let n = 0; n < bytesize; n++) {
                if (bit >= start && bit < end) {
                    const bitpos = bytesize - n - 1;
                    const bitmask = 1 << bitpos;
                    if (Math.random() < 0.5) {
                        b |= bitmask;
                    } else {
                        b &= ~bitmask;
                    }
                }
                bit++;
            }

            bytes[i] = b;
        }

        const tets = [];

        for (let i = 0; i < bytes.length; i++) {
            if (ipv6) {
                if (i % 2 === 0) {
                    tets[i >> 1] = ((bytes[i] << bytesize) | bytes[i + 1]).toString(16);
                }
            } else {
                tets[i] = bytes[i];
            }
        }

        return tets.join(ipv6 ? ':' : '.');
    }
}
