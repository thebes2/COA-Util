const Constants = {
    AND: 'AND',
    OR: 'OR',
    IN: 'IN',
    BETWEEN: 'BETWEEN',
    NOT: 'NOT',
    NOT_EQUAL: '<>',
    EQUAL: '=',
    SELECT: 'SELECT',
    WHERE: 'WHERE',
    GROUP_BY: 'GROUP BY',
    FROM: 'FROM',
    LIKE: 'LIKE'
};

// format for parsing different account types
// using class inheritance + auto generate constants

class Format {
    constructor(key_name, key_len, global_req = []) {
        // some more constants
        this.EXCLUDE_DELIMITER = /[\(\)\[\]]/;
        this.NUMBER_BASE = 10;
        this.LETTER_BASE = 26;
        this.PLACEHOLDER = '~';

        // independent variables
        this.KEY_NAME = key_name;
        this.KEY_LEN = key_len;
        this.GLOBAL_REQUIREMENTS = global_req.join(` ${Constants.AND} `) || '';

        // auto generate other constants
        this.KEY_RANGE = this.KEY_LEN.map(len => len>=0 ? Math.pow(this.NUMBER_BASE, len) : Math.pow(this.LETTER_BASE, -len));
        this.START_POS = this.KEY_LEN.reduce(({ vec, sm }, cur) => ({ vec: vec.concat(sm), sm: sm+Math.abs(cur) }), { vec: [], sm: 0 })['vec'];
        this.ACCOUNT_LEN = this.KEY_LEN.reduce((acc, cur) => acc+Math.abs(cur), 0);
        this.MAX_DEPTH = this.KEY_LEN.length;
    }
}

const BalanceSheet = new Format(
    ['MIS_ACCOUNT_TYPE_KEY', 'MIS_FUND_TYPE_KEY', 'MIS_LEVEL_2_KEY', 'MIS_LEVEL_3_KEY'],
    [1, 1, 1, 2]
);

const PrimaryAccount = new Format(
    ['MIS_ACCOUNT_TYPE_KEY', 'MIS_FUND_TYPE_KEY', 'MIS_LEVEL_2_KEY', 'MIS_LEVEL_3_KEY', 'MIS_LEVEL_4_KEY', 'MIS_LEVEL_5_KEY'],
    [1, 1, 1, 2, 2, 2]
);

// we will use negative key lengths to indicate chars
const SecondaryAccount = new Format(
    ['SC_TYPE_KEY', 'SC_BROAD_GROUP_KEY', 'SC_NATURE_KEY', 'SC_DETAIL_1_KEY'],
    [-1, 1, 2, 2]
);

const FinancialAccount = new Format(
    ['SC_BROAD_GROUP_KEY', 'SC_NATURE_KEY', 'SC_DETAIL_1_KEY'],
    [1, 2, 2],
    ['SC_TYPE_KEY=\'F\'']
);

// ---------------------------------------------------------------------------------

const DEBUG = false;

// ---------------------------------------------------------------------------------

// 'A' is 65 in ascii and 'a' is 97
const upper = x => ( 'a'<=x && x<='z'? String.fromCharCode(x.charCodeAt(0)-32) : x );

const ctoi = x => 'A'<=x&&x<='Z'? String.fromCharCode(x.charCodeAt(0)-91) : x;

// add support for parsing multiple chars from number (DONE)
const itoc = (x, len = 1) => {
    if(x>=0) return x;
    x = -(x+1);
    let ret = '';
    while (len>0) {
        len--;
        ret = String.fromCharCode(65+(x%26))+ret;
        x = Math.floor(x/26);
    }
    return ret;
};

const pad = (num, size) => {
    let s = String(itoc(num, size));
    while(s.length < size) s="0"+s;
    return s;
}

const match = (selector, pattern) => {
    if (selector.length != pattern.length) return false;
    for(let i=0;i<selector.length;i++){
        if(selector[i]!='~'&&selector[i]!=pattern[i]) return false;
    }
    return true;
}

const arrayEquals = (a, b) => {
    if (a.length !== b.length) return false;
    for (let i=0;i<a.length;i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

class QueryPath {
    constructor(_selector, format) {
        let selector = _selector.split('').map(c => upper(c)).join('');
        this.path = [];
        for (let i=0;i<format.MAX_DEPTH;i++){
            this.path.push([]);
            const sub = selector.substr(format.START_POS[i], Math.abs(format.KEY_LEN[i]));
            const start = format.KEY_LEN[i]<0 ? -format.KEY_RANGE[i]:0;
            const end = format.KEY_LEN[i]>0 ? format.KEY_RANGE[i]:0;

            for(let j=start;j<end;j++){
                if(match(sub, pad(j, Math.abs(format.KEY_LEN[i])))){
                    this.path[i].push(j);
                }
            }
        }
    }
    // determines if two QueryPaths can be merged at index
    similar(other, index) {
        for(let i=0;i<this.path.length;i++){
            if(i != index && !arrayEquals(this.path[i], other.path[i])) return false;
        }
        return true;
    }
}

const expand = (selector, format) => {
    if (selector.endsWith('*')){
        if (format.ACCOUNT_LEN-selector.length+1 < 0) {
            // throw ArgumentError;
            alert('Argument Length invalid.');
        }
        else selector = selector.replace('*', format.PLACEHOLDER.repeat(format.ACCOUNT_LEN-selector.length+1));
    }
    else if (selector.length != format.ACCOUNT_LEN) {
        // throw ArgumentError;
        alert('Argument Length invalid.');
    }
    return selector;
}

const replace = (str, idx, ch) => str.substring(0, idx) + ch + str.substring(idx+1);

const add = (str, idx, val) => {
    let carry = val;
    for (let i=idx;i>=0;i--) {
        if(str[i]>'9'||str[i]<'0') continue;
        let cur = str[i]-'0'+carry;
        str = replace(str, i, (cur+10)%10);
        if(cur<0) carry=-1;
        else if(cur>9) carry=1;
        else carry=0;
    }
    if (carry == 1) str = '1' + str;
    while (str[0] == '0') str = str.substring(1);
    return str;
}

const less = (a, b) => {
    if (a.length != b.length) return a.length < b.length;
    else return a < b;
}

const leq = (a, b) => {
    if (a.length != b.length) return a.length < b.length;
    else return a <= b;
}

const parse_token = (token, acc, format) => {
    if(token) token = token.trim();
    if(token) {
        // first transform internal '*' to '~'
        for (let i=0;i+1<token.length;i++) {
            if (token[i] == '*' && token[i+1] !== ' ') token = replace(token, i, '~');
        }
        if(token.match(/to/i)) {
            // create multiple selectors to cover range (like segment tree except less efficient D: )
            let [from, to] = token.split(/to/i).map(token => token.trim());
            let prefix = (from.length < to.length)? from.length : to.length;
            from = expand(from, format);
            to = expand(to, format);

            let lcs = '';
            while(from.length && from.slice(-1) == '~' && to.slice(-1) == '~') {
                lcs = from.slice(-1) + lcs;
                from = from.slice(0,-1);
                to = to.slice(0,-1);
            }

            for (let i=prefix-1;i<from.length;i++) {
                if (from[i] == '~' && to[i] != '~') from = replace(from, i, '0');
                if (to[i] == '~' && from[i] != '~') to = replace(to, i, '9');
            }

            for (let i=0;i<from.length;i++) {
                // there's ambiguity if internal wildcards don't match, so just throw an error if this happens
                // throw ArgumentError;
                if ((from[i] == '~' && to[i] != '~') || (to[i] == '~' && from[i] != '~')){
                    alert('Internal wildcards mismatch in \'to\' selector');
                }
            }

            to = add(to, to.length-1, 1);

            while (less(from, to)) {
                let idx = 0;
                for (let i=from.length-1;i>=0;i--) {
                    if (from[i] > '0' && from[i] <= '9') {
                        idx = i;
                        break;
                    }
                }
                for (let i=idx;i<from.length;i++) {
                    let next = add(from, i, 1);
                    if (leq(next, to)) {
                        for (let j=i+1;j<from.length;j++) from = replace(from, j, '~');
                        acc.push(from+lcs);
                        from = next;
                        break;
                    }
                }
            }

        }
        else{
            const pat = token.trim();
            acc.push(expand(pat, format));
        }
    }
    return acc;
}

const parse_query = (code, format) => {
    const segments = code.split(format.EXCLUDE_DELIMITER);

    let include_segments = [];
    let exclude_segments = [];

    for(let i=0;i<segments.length;i++){
        if(i&1) exclude_segments.push(segments[i]);
        else include_segments.push(segments[i]);
    }

    const include_tokens = include_segments.reduce(
        (acc, cur) => acc.concat(cur.split(',')), []
    );
    const exclude_tokens = exclude_segments.reduce(
        (acc, cur) => acc.concat(cur.split(',')), []
    );

    const include_selectors = include_tokens.reduce(
        (acc, cur) => parse_token(cur, acc, format), []
    );
    const exclude_selectors = exclude_tokens.reduce(
        (acc, cur) => parse_token(cur, acc, format), []
    );

    return {
        include_selectors,
        exclude_selectors
    };
}

const keyNameWrapper = (keyName) => {
    return `ltrim(rtrim(${keyName}))`;
}

const innerExp = (set, keyLen) => {
    return set.map(elem => `'${pad(elem, keyLen)}'`).join(',');
}

const inExp = (set, keyName, keyLen) => {
    return `${keyNameWrapper(keyName)}` + ((set.length == 1)? 
        `='${pad(set[0], keyLen)}'` :
        ` ${Constants.IN} (${innerExp(set, keyLen)})`
    );
}

const btwnExp = (set, keyName, keyLen) => {
    let min = pad(set[0], keyLen);
    let max = pad(set[set.length-1], keyLen);
    if(min>max) [min, max] = [max, min];
    return `${keyNameWrapper(keyName)} ${Constants.BETWEEN} '${min}' ${Constants.AND} '${max}'`;
}

const shouldUseInterval = (set, keyName, keyLen, isEmpty) => {
    const set_exp = isEmpty == 0? inExp(set, keyName, keyLen) : innerExp(set, keyName, keyLen);
    const int_exp = btwnExp(set, keyName, keyLen);
    // arbitrary penalty for readability reduction when using BETWEEN
    return int_exp.length + 4 < set_exp.length;
}

// generate an expression for [KEY_NAME] IN {}, operation
const generateSetExp = (depth, _set, format) => {
    // Split set into intervals and use either BETWEEN or IN for each interval
    const set = _set.sort((a,b)=>a-b);
    intervals = [];
    for (let i=0,j=0;i<set.length;i=j) {
        intervals.push([]);
        for (j=i;j<set.length&&set[j]-j==set[i]-i;j++) {
            intervals[intervals.length-1].push(set[j]);
        }
    }

    const keyName = format.KEY_NAME[depth];
    const keyLen = Math.abs(format.KEY_LEN[depth]);
    let useSet = [];
    let exp1 = '', exp2 = '', cnt = 0;

    for (let i=0;i<intervals.length;i++){
        if (shouldUseInterval(intervals[i], keyName, keyLen, exp1.length)) {
            if (exp2.length) exp2 += ` ${Constants.OR} `;
            exp2 += btwnExp(intervals[i], keyName, keyLen);
            cnt ++;
        }
        else {
            useSet = union(useSet, intervals[i]);
        }
    }

    if (useSet.length) {
        exp1 = inExp(useSet, keyName, keyLen);
    }

    if (exp1.length && exp2.length) {
        exp1 += ` ${Constants.OR} `;
        cnt += 100;
    }
    exp1 += exp2;
    if (cnt > 1) exp1 = "(" + exp1 + ")";
    return exp1;
}

// returns union of arrays a and b
const union = (a, b) => [...new Set([...a, ...b])].sort((a,b) => a-b);

// returns intersection of arrays a and b
const intersect = (a, b) => a.filter(e => b.includes(e))

// creates query in nested tree-like structure
const dfs = (depth, paths, format) => {
    if (depth == format.MAX_DEPTH || paths.length == 0) return { childexp: '', childchildnum: 0 };
    let exp = '', childnum = 0;
    let children = {};
    for (let i=0;i<paths.length;i++) {
        const path = paths[i];
        if (path.path[depth].length==0) continue;
        if (!children.hasOwnProperty(path.path[depth])){
            children[path.path[depth]] = [];
        }
        children[path.path[depth]].push(path);
    }
    for (let transition in children) {
        // format of each child branch is:  [transition] [transition&&child&&' AND '] ([child])
        const child = children[transition];
        let { childexp, childchildnum } = dfs(depth+1, child, format);
        if(DEBUG) console.log(transition, child, childexp, childchildnum);

        const trans = [...transition.split(',').map(token => parseInt(token))];

        if (trans.length == format.KEY_RANGE[depth]) {
            if (childexp.length > 0) {
                if (exp.length > 0) exp = exp + ` ${Constants.OR} `;
                exp = exp + childexp;
                if (childnum == 0) childnum = childchildnum;
                else childnum ++;
            }
        }
        else {
            if (childexp.length > 0) {
                if (exp.length > 0) exp = exp + ` ${Constants.OR} `;
                if (childchildnum > 1) childexp = '(' + childexp + ')';
                exp = exp + generateSetExp(depth, trans, format) + ` ${Constants.AND} ` + childexp;
            }
            else {
                if(exp.length > 0) exp = exp + ` ${Constants.OR} `;
                exp = exp + generateSetExp(depth, trans, format);
            }
            childnum ++;
        }
    }
    return {
        childexp: exp,
        childchildnum: childnum
    };
}

const generate_expression = (selectors, format) => {
    let paths = selectors.map(selector => new QueryPath(selector, format));
    
    for (let i=format.MAX_DEPTH-1;i>=0;i--) {
        let result = [];
        for (let j=0;j<paths.length;j++) {
            let done = false;
            for (let k=0;k<result.length;k++) {
                if (result[k].similar(paths[j], i)) {
                    result[k].path[i] = union(result[k].path[i], paths[j].path[i]);
                    done = true;
                    break;
                }
            }
            if (!done) {
                result.push(paths[j]);
            }
        }
        paths = result;
    }

    if(DEBUG) console.log(paths);

    const { childexp: expression, childchildnum: cnt } = dfs(0, paths, format);

    return cnt>1? `(${expression})` : expression;
}

const negate_expression = (expression) => `${Constants.NOT} (${expression})`;

const generate_query = (code, parseFormat) => {

    // remove all words in text that are not 'to'
    code = code.replace(/(?:(?<=(^|\s))[a-zA-Z]+(?=($|\s)))(?<!to)/ig, '');

    let { include_selectors, exclude_selectors } = parse_query(code, parseFormat);

    if(DEBUG) console.log(include_selectors);
    if(DEBUG) console.log(exclude_selectors);
    let include_exp = generate_expression(include_selectors, parseFormat);
    const exclude_exp = generate_expression(exclude_selectors, parseFormat);

    if (exclude_exp) include_exp = include_exp.concat(` ${Constants.AND} `, negate_expression(exclude_exp));
    if (parseFormat.GLOBAL_REQUIREMENTS.length) include_exp = parseFormat.GLOBAL_REQUIREMENTS.concat(` ${Constants.AND}\n\t`, include_exp);

    return include_exp;
}

const generate_db_query = (query, db, accounting_period, health_facility_key, param) => {
    return `${Constants.SELECT} HEALTH_FACILITY_KEY, ACCOUNTING_PERIOD, SUM(${param})\n` 
    + `${Constants.FROM} ${db}\n`
    + `${Constants.WHERE} ACCOUNTING_PERIOD ${Constants.LIKE} '${accounting_period}' ${Constants.AND} HEALTH_FACILITY_KEY${Constants.EQUAL}${health_facility_key} AND\n`
    + `\t${query}\n`
    + `${Constants.GROUP_BY} HEALTH_FACILITY_KEY, ACCOUNTING_PERIOD\n`;
}

const generate_db_list_all_query = (query, db, accounting_period, health_facility_key, param) => {
    return `${Constants.SELECT} HEALTH_FACILITY_KEY, ACCOUNTING_PERIOD, ${param}\n`
    + `${Constants.FROM} ${db}\n`
    + `${Constants.WHERE} ACCOUNTING_PERIOD ${Constants.LIKE} '${accounting_period}' ${Constants.AND} HEALTH_FACILITY_KEY${Constants.EQUAL}${health_facility_key} AND\n`
    + `\t${query}\n`
    + `${Constants.GROUP_BY} HEALTH_FACILITY_KEY, ACCOUNTING_PERIOD, ${param}\n`;
}

// ----------------------------------- "main" --------------------------------------------

const DB = [
    'FCLTY_BSA_YTD_ACTL_FORCST_DETL',
    'FCLTY_SECDY_AUD_ACTL_DETL',
    'FCLTY_SECDY_YTD_ACTL_FORCST_DT'
];

const QU = [
    'YTD_ACTUAL_AMOUNT',
    'YEAR_END_AUDITED_ACTUAL_AMOUNT'
];

const AP = [
    '%16Q2',
    '%09YE',
    '%20Q3',
    '%19Q2'
];

const HFK = [
    592,
    814,
    4541,
    251
];

const PA_QUERIES = [
    '1~2*, 1~3*',
    '121*, 131*',
    '1~3* excluding (1~300) more random text that must be filtered out',
    '11*, 12*, 13*, 21*, 22*, 23*, 31*, 32*, 33*, 41*, 42*, 43*, 51*, 52*, 53*',
    '11020, 11030 to 11090', 
    '31040 to 31085, 35040 TO 35085,  38040 To 38085, 39040 tO 39085 ',
    '1~307, 1~352, 1*487, 1*489, 1*490',
    '3~2*, 3~3*, 34*, 3*7* not including ( and excluding 3*280)',
    '4* [45100, 460*, 465*, 466*], 5* [560*, 565*, 566*], 6* [612*, 63030, 665*, 69571, 69700], 7* [72000, 75000, 75500, 76000, 78000], 8*, 9* [950*, 95500]',
    '1* to 9*'
];

const SA_QUERIES = [
    'F3* to F9* [F825*, F95040, F95060, f95065, f955*]',
    'F88* to F98*, S1~*, S2*, s4*',
    's8* to s9*'
];


const PA_QUERY = '8191530* to 8191536*, 8191550* to 8191566*, 8191576*';
const SA_QUERY = '11020, 11030 to 11090';
const QU_EXP = `${generate_query(PA_QUERY,PrimaryAccount)} AND ${generate_query(SA_QUERY,FinancialAccount)}`;
console.log(generate_db_query(QU_EXP, DB[2], '%16Q2', 947, QU[0]))
//console.log(generate_db_query(generate_query(QUERY, BalanceSheet), DB[0], AP[2], HFK[2], QU[0]));


// console.log(SA_QUERIES.map(QUERY => generate_query(QUERY, SecondaryAccount)).join("\n\n"));
//console.log(generate_db_list_all_query(generate_query(SA_QUERIES[2], SecondaryAccount), DB[1], AP[1], HFK[1], QU[1]));


/*const RandomAccount = new Format(
    ['A', 'B', 'C', 'D'],
    [1, -2, 1, 2]
);

const _QUERY = '3A~10* to 4A~10*';
console.log(generate_query(_QUERY, RandomAccount));*/



// For PA/SA use index 1 of presets for db query
// For Balance sheet accounts use index 0

// const QUERY = '71*, 81* [81925*, 81930*, 81935*, 81940*, 81965*]';
// const QUERY = '1~2*, 1~3*';
// console.log(generate_db_list_all_query(generate_query(QUERY, PrimaryAccount), DB[1], AP[1], HFK[1], QU[1]));
// console.log(PA_QUERIES.map(QUERY => generate_query(QUERY, BalanceSheet)).join("\n\n"));
// console.log(generate_db_query(generate_query(QUERY, BalanceSheet), DB[0], AP[0], HFK[0], QU[0]));




// const QUERY = '7* to 8*';
// console.log(generate_db_query(generate_query(QUERY, PrimaryAccount), DB[1], AP[1], HFK[1], QU[1]));