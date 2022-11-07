import { Injectable } from '@angular/core';
import JSZip from 'jszip';
import { SHA256 } from 'src/app/helpers/crypto/sha256';
@Injectable({
    providedIn: 'root'
})
export class DraftService {
    constructor() { }

    private sha256(buf: Buffer) {
        return SHA256.sha256Hash(buf, 'hex');
    }

    public reverseHash(draftHash: string): string {
        const reverseHash = draftHash
            .match(/[a-fA-F0-9]{2}/g)
            .reverse()
            .join('')
        return reverseHash;
    }

    public getDraft(filename: string, data: any): Promise<any> {
        return new Promise((resolve, reject) => {
            var zip = new JSZip();
            let fileContent = Buffer.from(JSON.stringify(data, null, 2), 'utf8');
            zip.file(filename, fileContent);
            zip.generateAsync({ type: "uint8array" }).then((zipcontent) => {
                let bufData = Buffer.from(zipcontent);
                let hexData = Buffer.from(zipcontent).toString('hex');
                let hexHash = this.getDraftHash(bufData);
                let ret = {data: hexData, hash: hexHash}
                resolve(ret);
            }, (error) => {});
        });
    }

    public getDraftHash(bufData: Buffer) {
        try {
            const hash = this.sha256(bufData);
            let hexHash = this.sha256(Buffer.from(hash, 'hex'));
            let ret = this.reverseHash(hexHash);
            return ret;
        }
        catch (err) {
            console.log(`getDraftHash err...`, err)
        }
    }
}
