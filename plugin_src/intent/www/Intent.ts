/*
* Copyright (c) 2021 Elastos Foundation
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
*/

let exec = cordova.exec;

class IntentManagerImpl implements EssentialsIntentPlugin.IntentManager {
    constructor() {
    }

    sendIntent(action: string, params: any): Promise<any> {
        return new Promise((resolve, reject)=>{
            exec((ret)=>{
                if (ret && (typeof (ret.result) == "string") && (ret.result.length > 0)) {
                    ret.result = JSON.parse(ret.result);
                }
                resolve(ret);
            },
            (err)=>{
              reject(err);
            },
            'IntentManager', 'sendIntent', [action, JSON.stringify(params)]);
          });
    }

    sendUrlIntent(url: string): Promise<any> {
        return new Promise((resolve, reject)=>{
            exec((ret)=>{
                if (ret && (typeof (ret.result) == "string") && (ret.result.length > 0)) {
                    ret.result = JSON.parse(ret.result);
                }
                resolve(ret);
            },
            (err)=>{
                reject(err);
            },
            'IntentManager', 'sendUrlIntent', [url]);
        });
    }

    addIntentListener(callback: (msg: EssentialsIntentPlugin.ReceivedIntent) => void) {
        function _onReceiveIntent(ret) {
            if (ret && (typeof (ret.params) == "string") && (ret.params.length > 0)) {
                ret.params = JSON.parse(ret.params);
            }
            if (callback) {
                callback(ret);
            }
        }
        exec(_onReceiveIntent, null, 'IntentManager', 'addIntentListener');
    }

    sendIntentResponse(result: any, intentId: number): Promise<void> {
        return new Promise((resolve, reject)=>{
            exec(()=>{
                resolve();
            },
            (err)=>{
                reject(err);
            },
            'IntentManager', 'sendIntentResponse', [JSON.stringify(result), intentId]);
        });
    }
}

export = new IntentManagerImpl();