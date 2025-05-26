import { Component, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { Platform } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import {
  BuiltInIcon,
  TitleBarIcon,
  TitleBarIconSlot,
  TitleBarMenuItem
} from 'src/app/components/titlebar/titlebar.types';
import { IdentityService } from 'src/app/didsessions/services/identity.service';
import { Styling } from 'src/app/didsessions/services/styling';
import { UXService } from 'src/app/didsessions/services/ux.service';
import { Logger } from 'src/app/logger';
import { Util } from 'src/app/model/util';
import { GlobalPreferencesService } from 'src/app/services/global.preferences.service';
import { GlobalStartupService } from 'src/app/services/global.startup.service';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import type { Swiper } from 'swiper';

@Component({
  selector: 'page-createidentity',
  templateUrl: 'createidentity.html',
  styleUrls: ['./createidentity.scss']
})
export class CreateIdentityPage {
  @ViewChild(TitleBarComponent, { static: true }) titleBar: TitleBarComponent;
  @ViewChild('swiper') private swiperEl!: ElementRef; swiper: Swiper

  public hidden = true;
  public slideIndex = 0;
  private initialSlide = 0;

  public isfirst = true;
  public styling = Styling;

  public passwordSheetState = 0; // DrawerState.Bottom
  public passwordSheetMinHeight = 0;
  public passwordSheetDockedHeight = 350;
  public password = '';
  public passwordConfirmation = '';
  public isLightweightMode = false;

  private titleBarIconClickedListener: (icon: TitleBarIcon | TitleBarMenuItem) => void;

  constructor(
    public router: Router,
    private platform: Platform,
    private identityService: IdentityService,
    private uxService: UXService,
    private translate: TranslateService,
    public theme: GlobalThemeService,
    private globalPreferences: GlobalPreferencesService
  ) {
    const navigation = this.router.getCurrentNavigation();
    if (!Util.isEmptyObject(navigation.extras.state)) {
      this.isfirst = false;
      Logger.log('didsessions', 'Setting create identity screen initial slide to index 1');
      this.initialSlide = 1;
    }
  }

  ngAfterViewInit() {
    if (this.initialSlide > 0) {
      this.swiperEl?.nativeElement?.swiper?.slideTo(this.initialSlide, 0, false)
    }
  }

  async ionViewWillEnter() {
    // Check lightweight mode preference
    try {
      this.isLightweightMode = await this.globalPreferences.getLightweightMode('', '');
    } catch (error) {
      Logger.log('didsessions', 'Error getting lightweight mode preference, defaulting to false:', error);
      this.isLightweightMode = false;
    }

    const titleKey = this.isLightweightMode ? 'didsessions.create-wallet' : 'didsessions.create-identity';
    this.titleBar.setTitle(this.translate.instant(titleKey));
    this.titleBar.setIcon(TitleBarIconSlot.OUTER_LEFT, { key: 'backToRoot', iconPath: BuiltInIcon.BACK });
    this.titleBar.setIcon(TitleBarIconSlot.OUTER_RIGHT, { key: 'settings', iconPath: BuiltInIcon.SETTINGS });
    this.titleBar.setNavigationMode(null);
    this.titleBar.addOnItemClickedListener(
      (this.titleBarIconClickedListener = icon => {
        this.uxService.onTitleBarItemClicked(icon);
      })
    );

    this.swiper = this.swiperEl?.nativeElement?.swiper;

    // Dirty hack because on iOS we are currently unable to understand why the
    // swiper-slides width is sometimes wrong when an app starts. Waiting a few
    // seconds (DOM fully rendered once...?) seems to solve this problem.
    if (this.platform.platforms().indexOf('ios') >= 0) {
      setTimeout(() => {
        this.showSlider();
      }, 300);
    } else {
      this.showSlider();
    }
  }

  ionViewDidEnter() {
    // We are ready, we can hide the splash screen
    GlobalStartupService.instance.setStartupScreenReady();
  }

  ionViewWillLeave() {
    this.titleBar.removeOnItemClickedListener(this.titleBarIconClickedListener);
  }

  showSlider() {
    Logger.log('didsessions', 'Showing created identity screen slider');
    this.hidden = false;
  }

  async getActiveSlide() {
    this.slideIndex = this.swiper?.activeIndex || 0;
    Logger.log('didsessions', '----getActiveSlide:', this.slideIndex);
  }

  nextSlide() {
    this.swiper?.slideNext();
    Logger.log('didsessions', '----nextSlide:');
  }

  onSlideIndexChange(slideIndex: number) {
    this.slideIndex = slideIndex;
  }

  onNextSlide() {
    // Event handled by advanced-mode component
  }

  createNewIdentity() {
    this.identityService.startCreatingNewDIDWithNewMnemonic();
  }

  async importIdentity(existingMnemonic: string = null) {
    // Import by typing a mnemonic or from an existing one (wallet)
    await this.identityService.startImportingMnemonic(existingMnemonic);
  }

  createWallet() {
    // Create a new wallet (same as createNewIdentity for now)
    this.identityService.startCreatingNewDIDWithNewMnemonic();
  }

  async importWallet(existingMnemonic: string = null) {
    // Import wallet (same as importIdentity for now)
    await this.identityService.startImportingMnemonic(existingMnemonic);
  }

  shouldShowBack() {
    return !this.isfirst;
  }
}
