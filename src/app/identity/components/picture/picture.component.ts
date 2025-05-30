import { Component, NgZone, OnInit, ViewChild } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { BuiltInIcon, TitleBarIcon, TitleBarIconSlot, TitleBarMenuItem } from 'src/app/components/titlebar/titlebar.types';
import { dataUrlToRawImageData, pictureMimeType } from 'src/app/helpers/picture.helpers';
import { Logger } from 'src/app/logger';
import { GlobalEvents } from 'src/app/services/global.events.service';
import { GlobalNativeService } from 'src/app/services/global.native.service';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { LocalStorage } from '../../services/localstorage';
import { ProfileService } from '../../services/profile.service';

@Component({
  selector: 'app-picture',
  templateUrl: './picture.component.html',
  styleUrls: ['./picture.component.scss'],
})
export class PictureComponent implements OnInit {
  @ViewChild(TitleBarComponent, { static: true }) titleBar: TitleBarComponent;

  private titleBarIconClickedListener: (icon: TitleBarIcon | TitleBarMenuItem) => void;

  /**
   * Static object used to receive the existing picture, and return the new one if any.
   */
  public static shared: {
    dataUrlImageIn?: string; // Existing picture to display as "current picture", if any. Format: data:image/xxx...
    rawBase64ImageOut?: string; // Newly chosen picture, if different from the received one. Base64 encoded.
    dataUrlImageOut?: string; // Same as rawImageOut but as a data url (data:image/png...)
  } = {};

  public dataUrlImage: string = null;

  constructor(
    private modalCtrl: ModalController,
    private zone: NgZone,
    public profileService: ProfileService,
    public theme: GlobalThemeService,
    public storage: LocalStorage,
    private native: GlobalNativeService,
    public events: GlobalEvents
  ) { }

  ngOnInit() {
    if (PictureComponent.shared.dataUrlImageIn) {
      Logger.log('Identity', 'Showing picture chooser with existing image');
      PictureComponent.shared.dataUrlImageOut = PictureComponent.shared.dataUrlImageIn;
      PictureComponent.shared.rawBase64ImageOut = dataUrlToRawImageData(PictureComponent.shared.dataUrlImageIn);
    } else {
      Logger.log('Identity', 'Showing picture chooser with no existing image');
      PictureComponent.shared.dataUrlImageOut = null;
      PictureComponent.shared.rawBase64ImageOut = null;
    }
  }

  ionViewWillEnter() {
    this.titleBar.setNavigationMode(null); // Modals are not part of page stack, therefore we dont use navigation mode
    this.titleBar.setIcon(TitleBarIconSlot.OUTER_LEFT, { key: null, iconPath: BuiltInIcon.CLOSE }); // Replace ela logo with close icon
    this.titleBar.addOnItemClickedListener(this.titleBarIconClickedListener = (icon) => {
      void this.modalCtrl.dismiss();
    });

    if (PictureComponent.shared.dataUrlImageIn) {
      this.dataUrlImage = PictureComponent.shared.dataUrlImageIn;
    }
  }

  ionViewWillLeave() {
    this.titleBar.removeOnItemClickedListener(this.titleBarIconClickedListener);
    // let the editprofile screen to show menu
    this.events.publish('editprofile-showmenu');
  }

  takePicture(sourceType: number) {
    const options: CameraOptions = {
      quality: 90,
      destinationType: 0,
      encodingType: 1, // PNG
      mediaType: 0,
      correctOrientation: true,
      sourceType: sourceType,
      targetWidth: 350,
      targetHeight: 350
    };

    navigator.camera.getPicture((imageData) => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.zone.run(async () => {
        //Logger.log('Identity', "Chosen image data base64:", imageData);

        if (imageData) {
          if (imageData.startsWith("data:")) {
            PictureComponent.shared.rawBase64ImageOut = dataUrlToRawImageData(imageData);
            PictureComponent.shared.dataUrlImageOut = imageData;
          } else {
            let mimeType = await pictureMimeType(imageData);

            if (["image/png", "image/jpg", "image/jpeg"].indexOf(mimeType) < 0) {
              Logger.warn('identity mimeType:', mimeType);
              this.native.genericToast('identity.not-a-valid-picture');
              return;
            }
            PictureComponent.shared.rawBase64ImageOut = imageData;
            PictureComponent.shared.dataUrlImageOut = 'data:' + mimeType + ';base64,' + imageData;
          }

          this.dataUrlImage = PictureComponent.shared.dataUrlImageOut;
        }
      });
    }, ((err) => {
      Logger.error('identity', err);
    }), options);
  }

  submit(useImg: boolean): void {
    void this.modalCtrl.dismiss({
      useImg: useImg
    });
  }
}
