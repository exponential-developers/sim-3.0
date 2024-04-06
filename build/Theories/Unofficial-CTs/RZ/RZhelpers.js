export const resolution = 4;
export const getBlackholeSpeed = (z) => Math.min(Math.pow(z, 2) + 0.004, 1 / resolution);
export const getb = (level) => 1 << level;
// const getbMarginTerm = (level: number) => Math.pow(10, -getb(level));
export const c1Exp = [1, 1.14, 1.21, 1.25];
const interpolate = (t) => {
    const v1 = t * t;
    const v2 = 1 - (1 - t) * (1 - t);
    return v1 * (1 - t) + v2 * t;
};
const zeta01Table = [
    [-1.4603545088095868, 0],
    [-1.4553643660270397, -0.097816768303847834],
    [-1.4405420816461549, -0.19415203999960912],
    [-1.4163212212231056, -0.28759676077859003],
    [-1.3833896356482762, -0.37687944704548237],
    [-1.342642133546631, -0.46091792561979039],
    [-1.2951228211781993, -0.53885377540755575],
    [-1.241963631033884, -0.61006813708679553],
    [-1.1843251208316332, -0.67417998953208147],
    [-1.1233443487784422, -0.73102985025790079],
    [-1.0600929156957051, -0.78065292187264657],
    [-0.99554650742447182, -0.82324597632456875],
    [-0.93056577332974644, -0.85913190352918178],
    [-0.86588730259376534, -0.88872508711130638],
    [-0.80212284363487529, -0.91249984322356881],
    [-0.73976469567777448, -0.93096325430469185],
    [-0.679195280748696, -0.94463296464946644],
    [-0.62069916587171792, -0.954019930248939],
    [-0.56447615104191817, -0.95961573448940385],
    [-0.5106543967354793, -0.96188386780424429],
    [-0.45930289034601818, -0.96125428450587913],
    [-0.41044282155026063, -0.95812055392531381],
    [-0.36405764581325084, -0.95283898111582577],
    [-0.32010176657189976, -0.94572915808929037],
    [-0.27850786866599236, -0.93707550120555738],
    [-0.23919299859739693, -0.92712942212746241],
    [-0.20206352115099815, -0.91611186212496687],
    [-0.167019095423191, -0.90421598956695581],
    [-0.13395581328989362, -0.89160991763812381],
    [-0.10276863503870383, -0.87843934448552852],
    [-0.073353244053944222, -0.86483005263542623],
    [-0.045607427657960491, -0.850890230359152],
    [-0.019432076150895955, -0.836712596410336],
    [0.0052681222316752355, -0.82237632273994077],
    [0.028584225755178324, -0.80794875873014349],
    [0.050602769823360656, -0.7934869662472297],
    [0.071405640533511838, -0.77903907825261309],
    [0.091070056261173163, -0.76464549549431216],
    [0.10966862939766708, -0.750339936434268],
    [0.12726948615366909, -0.73615035542727014],
    [0.14393642707718907, -0.722099743531673],
];
// Linear interpolation lol
const zetaSmall = (t) => {
    const fullIndex = t * (zeta01Table.length - 1);
    const index = Math.floor(fullIndex);
    const offset = fullIndex - index;
    const re = zeta01Table[index][0] * (1 - offset) + zeta01Table[index + 1][0] * offset;
    const im = zeta01Table[index][1] * (1 - offset) + zeta01Table[index + 1][1] * offset;
    return [re, im, Math.sqrt(re * re + im * im)];
};
const even = (n) => {
    if (n % 2 === 0)
        return 1;
    else
        return -1;
};
const theta = (t) => {
    return (t / 2) * Math.log(t / 2 / Math.PI) - t / 2 - Math.PI / 8 + 1 / 48 / t + 7 / 5760 / t / t / t;
};
const C = (n, z) => {
    if (n === 0)
        return (0.3826834323650897 * Math.pow(z, 0.0) +
            0.4372404680775204 * Math.pow(z, 2.0) +
            0.1323765754803435 * Math.pow(z, 4.0) -
            0.013605026047674188 * Math.pow(z, 6.0) -
            0.01356762197010358 * Math.pow(z, 8.0) -
            0.001623725323144465 * Math.pow(z, 10.0) +
            0.0002970535373337969 * Math.pow(z, 12.0) +
            0.0000794330087952147 * Math.pow(z, 14.0) +
            0.00000046556124614505 * Math.pow(z, 16.0) -
            0.00000143272516309551 * Math.pow(z, 18.0) -
            0.00000010354847112313 * Math.pow(z, 20.0) +
            0.00000001235792708386 * Math.pow(z, 22.0) +
            0.0000000017881083858 * Math.pow(z, 24.0) -
            0.0000000000339141439 * Math.pow(z, 26.0) -
            0.0000000000163266339 * Math.pow(z, 28.0) -
            0.00000000000037851093 * Math.pow(z, 30.0) +
            0.00000000000009327423 * Math.pow(z, 32.0) +
            0.00000000000000522184 * Math.pow(z, 34.0) -
            0.00000000000000033507 * Math.pow(z, 36.0) -
            0.00000000000000003412 * Math.pow(z, 38.0) +
            0.00000000000000000058 * Math.pow(z, 40.0) +
            0.00000000000000000015 * Math.pow(z, 42.0));
    else if (n === 1)
        return (-0.02682510262837534 * Math.pow(z, 1.0) +
            0.013784773426351853 * Math.pow(z, 3.0) +
            0.03849125048223508 * Math.pow(z, 5.0) +
            0.00987106629906207 * Math.pow(z, 7.0) -
            0.003310759760858404 * Math.pow(z, 9.0) -
            0.001464780857795415 * Math.pow(z, 11.0) -
            0.00001320794062487696 * Math.pow(z, 13.0) +
            0.00005922748701847141 * Math.pow(z, 15.0) +
            0.00000598024258537345 * Math.pow(z, 17.0) -
            0.00000096413224561698 * Math.pow(z, 19.0) -
            0.00000018334733722714 * Math.pow(z, 21.0) +
            0.00000000446708756272 * Math.pow(z, 23.0) +
            0.00000000270963508218 * Math.pow(z, 25.0) +
            0.00000000007785288654 * Math.pow(z, 27.0) -
            0.00000000002343762601 * Math.pow(z, 29.0) -
            0.00000000000158301728 * Math.pow(z, 31.0) +
            0.00000000000012119942 * Math.pow(z, 33.0) +
            0.00000000000001458378 * Math.pow(z, 35.0) -
            0.00000000000000028786 * Math.pow(z, 37.0) -
            0.00000000000000008663 * Math.pow(z, 39.0) -
            0.00000000000000000084 * Math.pow(z, 41.0) +
            0.00000000000000000036 * Math.pow(z, 43.0) +
            0.00000000000000000001 * Math.pow(z, 45.0));
    else if (n === 2)
        return (0.0051885428302931684 * Math.pow(z, 0.0) +
            0.0003094658388063474 * Math.pow(z, 2.0) -
            0.011335941078229373 * Math.pow(z, 4.0) +
            0.002233045741958144 * Math.pow(z, 6.0) +
            0.00519663740886233 * Math.pow(z, 8.0) +
            0.0003439914407620833 * Math.pow(z, 10.0) -
            0.0005910648427470582 * Math.pow(z, 12.0) -
            0.00010229972547935857 * Math.pow(z, 14.0) +
            0.00002088839221699276 * Math.pow(z, 16.0) +
            0.00000592766549309654 * Math.pow(z, 18.0) -
            0.00000016423838362436 * Math.pow(z, 20.0) -
            0.00000015161199700941 * Math.pow(z, 22.0) -
            0.00000000590780369821 * Math.pow(z, 24.0) +
            0.00000000209115148595 * Math.pow(z, 26.0) +
            0.00000000017815649583 * Math.pow(z, 28.0) -
            0.00000000001616407246 * Math.pow(z, 30.0) -
            0.00000000000238069625 * Math.pow(z, 32.0) +
            0.00000000000005398265 * Math.pow(z, 34.0) +
            0.00000000000001975014 * Math.pow(z, 36.0) +
            0.00000000000000023333 * Math.pow(z, 38.0) -
            0.00000000000000011188 * Math.pow(z, 40.0) -
            0.00000000000000000416 * Math.pow(z, 42.0) +
            0.00000000000000000044 * Math.pow(z, 44.0) +
            0.00000000000000000003 * Math.pow(z, 46.0));
    else if (n === 3)
        return (-0.001339716090719456 * Math.pow(z, 1.0) +
            0.003744215136379393 * Math.pow(z, 3.0) -
            0.0013303178919321468 * Math.pow(z, 5.0) -
            0.002265466076547178 * Math.pow(z, 7.0) +
            0.000954849999850673 * Math.pow(z, 9.0) +
            0.00060100384589636 * Math.pow(z, 11.0) -
            0.00010128858286776622 * Math.pow(z, 13.0) -
            0.00006865733449299826 * Math.pow(z, 15.0) +
            0.00000059853667915386 * Math.pow(z, 17.0) +
            0.00000333165985123995 * Math.pow(z, 19.0) +
            0.00000021919289102435 * Math.pow(z, 21.0) -
            0.00000007890884245681 * Math.pow(z, 23.0) -
            0.0000000094146850813 * Math.pow(z, 25.0) +
            0.00000000095701162109 * Math.pow(z, 27.0) +
            0.00000000018763137453 * Math.pow(z, 29.0) -
            0.00000000000443783768 * Math.pow(z, 31.0) -
            0.00000000000224267385 * Math.pow(z, 33.0) -
            0.00000000000003627687 * Math.pow(z, 35.0) +
            0.00000000000001763981 * Math.pow(z, 37.0) +
            0.00000000000000079608 * Math.pow(z, 39.0) -
            0.0000000000000000942 * Math.pow(z, 41.0) -
            0.00000000000000000713 * Math.pow(z, 43.0) +
            0.00000000000000000033 * Math.pow(z, 45.0) +
            0.00000000000000000004 * Math.pow(z, 47.0));
    else
        return (+0.0004648338936176338 * Math.pow(z, 0.0) -
            0.001005660736534047 * Math.pow(z, 2.0) +
            0.0002404485657372579 * Math.pow(z, 4.0) +
            0.001028308614970232 * Math.pow(z, 6.0) -
            0.0007657861071755644 * Math.pow(z, 8.0) -
            0.00020365286803084818 * Math.pow(z, 10.0) +
            0.0002321229049106872 * Math.pow(z, 12.0) +
            0.0000326021442438652 * Math.pow(z, 14.0) -
            0.00002557906251794953 * Math.pow(z, 16.0) -
            0.00000410746443891574 * Math.pow(z, 18.0) +
            0.00000117811136403713 * Math.pow(z, 20.0) +
            0.00000024456561422485 * Math.pow(z, 22.0) -
            0.00000002391582476734 * Math.pow(z, 24.0) -
            0.00000000750521420704 * Math.pow(z, 26.0) +
            0.00000000013312279416 * Math.pow(z, 28.0) +
            0.00000000013440626754 * Math.pow(z, 30.0) +
            0.00000000000351377004 * Math.pow(z, 32.0) -
            0.00000000000151915445 * Math.pow(z, 34.0) -
            0.00000000000008915418 * Math.pow(z, 36.0) +
            0.00000000000001119589 * Math.pow(z, 38.0) +
            0.0000000000000010516 * Math.pow(z, 40.0) -
            0.00000000000000005179 * Math.pow(z, 42.0) -
            0.00000000000000000807 * Math.pow(z, 44.0) +
            0.00000000000000000011 * Math.pow(z, 46.0) +
            0.00000000000000000004 * Math.pow(z, 48.0));
};
const logLookup = [];
const sqrtLookup = [];
const riemannSiegelZeta = (t, n) => {
    let Z = 0;
    let R = 0;
    const fullN = Math.sqrt(t / (2 * Math.PI));
    const N = Math.floor(fullN);
    const p = fullN - N;
    const th = theta(t);
    for (let j = 1; j <= N; ++j) {
        if (logLookup[j] === undefined) {
            logLookup[j] = Math.log(j);
            sqrtLookup[j] = Math.sqrt(j);
        }
        Z += Math.cos(th - t * logLookup[j]) / sqrtLookup[j];
    }
    Z *= 2;
    for (let k = 0; k <= n; ++k) {
        R += C(k, 2 * p - 1) * Math.pow((2 * Math.PI) / t, k * 0.5);
    }
    R *= even(N - 1) * Math.pow((2 * Math.PI) / t, 0.25);
    Z += R;
    return [Z * Math.cos(th), -Z * Math.sin(th), Z];
};
export const lookups = {
    zetaLookup: [],
    zetaDerivLookup: [],
    prevDt: 1.5,
    prevDdt: 1.0001,
};
export const zeta = (T, ticks, offGrid, cache) => {
    if (!offGrid && cache[ticks])
        return cache[ticks];
    const t = Math.abs(T);
    let z;
    if (t >= 1)
        z = riemannSiegelZeta(t, 1);
    else if (t < 0.1)
        z = zetaSmall(t);
    else {
        const offset = interpolate(((t - 0.1) * 10) / 9);
        const a = zetaSmall(t);
        const b = riemannSiegelZeta(t, 1);
        z = [a[0] * (1 - offset) + b[0] * offset, a[1] * (1 - offset) + b[1] * offset, a[2] * (1 - offset) + Math.abs(b[2]) * offset];
    }
    if (T < 0)
        z[1] = -z[1];
    if (!offGrid)
        cache[ticks] = z;
    return z;
};