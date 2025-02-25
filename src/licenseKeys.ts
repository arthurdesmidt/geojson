// licenseKeys.ts
export const VALID_LICENSES = [
    "WMTK-PJZV-NRXQ-7219",
    "PDAS-BFGL-HRVZ-3584",
    "KNEV-UXBF-DWQZ-6132",
    "ZCMT-JPKD-ERFX-8475",
    "FVLG-KXPY-TDNW-1958",
    "RMJP-BTQY-VHWG-4367",
    "XHND-QTLP-BSFC-9241",
    "JKGP-ZRVT-LFMQ-5836",
    "TNWV-BDMG-HQKX-7094",
    "GQFW-CXJP-RLMN-3615",
    "DHBR-LPTV-XNFK-2487",
    "PNWQ-XGJF-KMTZ-8921",
    "VHJC-NFXP-QBWR-5730",
    "CRZM-WFLQ-TKBJ-6845",
    "BNLG-DVHP-MXKT-1973",
    "QVLZ-KWFT-CPMG-4516",
    "TFMR-GXPH-JZNQ-9328",
    "LWBJ-XHNT-DRKF-6752",
    "ZHNK-PBXC-VFTW-3194",
    "MXFR-JVZN-QWTB-8467",
    "KPTD-NWZF-GVXQ-5279",
    "RXVC-JMGL-WNTB-1834",
    "FBHK-TPRJ-MCZV-7495",
    "JPVL-NGRK-QCDZ-2681",
    "WCZT-XQLM-RGFB-9537",
    "LQGM-FPNR-ZVBW-4062",
    "NBTX-VKDH-CLGZ-8713",
    "HFDP-GQBK-ZXLW-5924",
    "VPCK-RTXJ-MHBN-3146",
    "DTRW-BPMG-NQFK-7638",
    "GBPV-JFHC-TXNM-2859",
    "XQNZ-KGBH-PWJR-4371",
    "TBCL-MVHW-XRGK-9582",
    "CPFR-ZWGK-QVBM-6043",
    "MJKL-HBNZ-GFDP-1427",
    "SGNW-LXJF-VRBP-8275",
    "BGDX-PRHJ-MFKW-5316",
    "PVKR-THBN-XJQM-3794",
    "ZTXH-FCNM-LGBK-6847",
    "HQBC-JNWK-PDRF-9251",
    "KLWZ-VXQF-CRDT-4672",
    "DVBP-MNZF-GQTJ-7138",
    "WLJG-PCVN-KHBR-2594",
    "NTPH-WQKB-XGZR-5843",
    "FMQG-ZKCL-JVBW-1976",
    "RHWJ-BPVT-DXLN-8425",
    "QLXK-PNZM-VFCG-3764",
    "JZFN-DBXV-WKLG-6592",
    "XBDV-TGZP-KNMR-4137",
    "MGFT-NPVX-CWRJ-9283"
];




// Add helper functions for license management
export function isValidLicense(licenseKey: string): boolean {
    // Log the validation attempt
    console.log('Validating license key:', licenseKey);
    
    // Check format first
    if (!licenseKey || 
        licenseKey.length !== 19 ||
        licenseKey.charAt(4) !== '-' ||
        licenseKey.charAt(9) !== '-' ||
        licenseKey.charAt(14) !== '-') {
        console.log('License format invalid');
        return false;
    }
    
    // Check against valid licenses
    const isValid = VALID_LICENSES.indexOf(licenseKey) !== -1;
    console.log('License validation result:', isValid);
    return isValid;
}

// For future use - could be expanded to manage license features
export interface LicenseInfo {
    isValid: boolean;
    expiryDate?: Date;
    features?: string[];
    licenseType?: string;
}

export function getLicenseInfo(key: string): LicenseInfo {
    if (!isValidLicense(key)) {
        return { isValid: false };
    }
    
    // For now, all valid licenses have the same features
    return {
        isValid: true,
        expiryDate: new Date(2030, 11, 31), // Dec 31, 2030
        features: ['all'],
        licenseType: 'premium'
    };
}