import { Injectable } from '@angular/core';
import { Logger } from 'src/app/logger';
import { GlobalStorageService } from 'src/app/services/global.storage.service';

@Injectable({
    providedIn: 'root'
})
export class LocalStorage {
    public static instance: LocalStorage = null;

    constructor(private storage: GlobalStorageService) {
        LocalStorage.instance = this;
    }

    private add(key: string, value: any): any {
        return this.get(key).then((val) => {
            let id = value['id'];
            if (val === null) {
                let initObj = {};
                initObj[id] = value;
                return GlobalStorageService.ionicStorage.set(key, JSON.stringify(initObj));
            }
            let addObj = JSON.parse(val);
            addObj[id] = value;
            return GlobalStorageService.ionicStorage.set(key, JSON.stringify(addObj));
        });
    }

    public set(key: string, value: any): Promise<any> {
        return GlobalStorageService.ionicStorage.set(key, value);
    }

    public get(key: string): Promise<any> {
        return GlobalStorageService.ionicStorage.get(key);
    }

    public remove(key: string): any {
        return GlobalStorageService.ionicStorage.remove(key);
    }

    public setPhoto(value: any) {
        return GlobalStorageService.ionicStorage.set("photo", JSON.stringify(value)).then((data) => {
            Logger.log('Identity', 'Set profile pic', data);
        });
    }

    public getPhoto(): Promise<any> {
        return GlobalStorageService.ionicStorage.get("photo").then((data) => {
            Logger.log('Identity', 'Get profile pic', data);
            return JSON.parse(data);
        });
    }
}


