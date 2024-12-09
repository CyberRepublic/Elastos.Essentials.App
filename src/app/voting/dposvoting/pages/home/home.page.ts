import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Platform } from '@ionic/angular';
import { GlobalStorageService } from 'src/app/services/global.storage.service';
import { NetworkTemplateStore } from 'src/app/services/stores/networktemplate.store';
import { DIDSessionsStore } from './../../../../services/stores/didsessions.store';

@Component({
    selector: 'app-home',
    templateUrl: './home.page.html',
    styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {
    @ViewChild('swiper') private swiperEl!: ElementRef;

    hidden = true;

    next(slide) {
        slide.slideNext();
    }

    prev(slide) {
        slide.slidePrev();
    }

    constructor(
        private router: Router,
        private storage: GlobalStorageService,
        private platform: Platform,
    ) {
    }

    ngOnInit() { }

    ionViewWillEnter() {
    }

    ionViewDidEnter() {
        // Dirty hack because on iOS we are currently unable to understand why the
        // swiper-slides width is sometimes wrong when an app starts. Waiting a few
        // seconds (DOM fully rendered once...?) seems to solve this problem.
        if (this.platform.platforms().indexOf('ios') >= 0) {
            setTimeout(() => {
                this.showSlider();
            }, 3000)
        }
        else {
            this.showSlider();
        }
    }

    showSlider() {
        this.hidden = false
    }

    goToVote() {
        void this.storage.setSetting(DIDSessionsStore.signedInDIDString, NetworkTemplateStore.networkTemplate, "dposvoting", "visited", true);
        void this.router.navigate(['menu/vote']);
    }
}
