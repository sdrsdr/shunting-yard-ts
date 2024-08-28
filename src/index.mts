//Copyright (c) 2024 Stoian Ivanov (https://github.com/sdrsdr/shunting-yard-ts)

//Inspired by https://github.com/Skarlett/shunting-yard-rs

enum TOKS {
	num,
	opb,
	clb,
	add,
	sub,
	mul,
	div,
	mod,
	pow,

	//keep this last
	err,
}
let PREC=new Array<number>(TOKS.err);

//makr invalid one
PREC[TOKS.num]=-1;
PREC[TOKS.clb]=-1;
PREC[TOKS.err]=-1;

//operators precedence
PREC[TOKS.pow]=3;

PREC[TOKS.div]=2;
PREC[TOKS.mul]=2;
PREC[TOKS.mod]=2;

PREC[TOKS.add]=1;
PREC[TOKS.sub]=1;

PREC[TOKS.opb]=0;


function c2TOKS(c:string):TOKS {
	switch(c){
		case '+' : return TOKS.add;
		case '-' : return TOKS.sub;
		case '(' : return TOKS.opb;
		case ')' : return TOKS.clb;
		case '*' : return TOKS.mul;
		case '/' : return TOKS.div;
		case '%' : return TOKS.mod;
		case '^' : return TOKS.pow;

	}
	return TOKS.err;
}

interface tok_t {
	tokstart:number;
	type:TOKS,
	src:string;
}

interface numtok_t extends tok_t{
	type:TOKS.num,
	val:number,
	got_decp:boolean;
	got_lws:boolean;
}
function tok_is_num(tok:tok_t|undefined): tok is numtok_t {
	return tok!==undefined && tok.type==TOKS.num
}

interface TokenizeError {
	msg:string;
	errpos:number;
}


/** tokenize infix expression such as  "4*(1+2)" from string.
* -----------------------
* @param exp: the infix expression string
*/
function tokenize_infix(exp:string): Array<tok_t> | TokenizeError {
	let toks=new Array<tok_t>();
	let lastt:tok_t|undefined;
	for (let i=0; i<exp.length;i++){
		let c=exp[i];

		switch (c) {
			case ' ':
			case '\t':
			case '\n':
			case '\r': {
				if (tok_is_num(lastt)) lastt.got_lws=true;
				continue;
			}
		}	
		switch (c) {
			case '+' :
			case '-' :{
				if (lastt==undefined || lastt.type==TOKS.opb){
					lastt={src:(c=='-'?'-':''),type:TOKS.num,tokstart:i};
					toks.push(lastt);
					continue;
				}
				if (lastt.type==TOKS.num || lastt.type==TOKS.clb) {
					if (lastt.src=='' || lastt.src=='-') {
						return {msg:'unexpected "'+c+'"; expected number',errpos:i} satisfies TokenizeError ;
					}
					lastt={src:c,type:(c=='-'?TOKS.sub:TOKS.add), tokstart:i};
					toks.push(lastt);
					continue;
				}
				if (lastt.type==TOKS.add || lastt.type==TOKS.sub || lastt.type==TOKS.mul || lastt.type==TOKS.div|| lastt.type==TOKS.mod || lastt.type==TOKS.pow) {
					lastt={src:(c=='-'?'-':''),type:TOKS.num,tokstart:i};
					toks.push(lastt);
					continue;
				}
				return {msg:'unexpected "'+c+'" as unary operator',errpos:i} satisfies TokenizeError ;
			}

			case '*' :
			case '/' :
			case '%' :
			case '^' :{
				if (lastt==undefined){
					return {msg:'unexpected "'+c+'"; expected number for start',errpos:i} satisfies TokenizeError ;
				}

				if (lastt.type==TOKS.num || lastt.type==TOKS.clb) {
					if (lastt.src=='' || lastt.src=='-') {
						return {msg:'unexpected "'+c+'"; expected number',errpos:i} satisfies TokenizeError ;
					}

					lastt={src:c,type:c2TOKS(c), tokstart:i};
					toks.push(lastt);
					continue;
				}
				return {msg:'unexpected "'+c+'" (too many operators)',errpos:i} satisfies TokenizeError ;
			}
			case '(' : {
				if (lastt==undefined){
					lastt={src:c,type:TOKS.opb, tokstart:i};
					toks.push(lastt);
					continue;
				}
				if (lastt.type==TOKS.num || lastt.type==TOKS.clb) {
					return {msg:'expected operator but "(" found',errpos:i} satisfies TokenizeError ;
				}
				lastt={src:c,type:TOKS.opb, tokstart:i};
				toks.push(lastt);
				continue;;
			}
			case ')' : {
				if (lastt==undefined){
					return {msg:'expected start but ")" found',errpos:i} satisfies TokenizeError ;
				}
				if (! (lastt.type==TOKS.num ||  lastt.type==TOKS.clb )){
					return {msg:'unexpected ")"',errpos:i} satisfies TokenizeError ;
				}
				lastt={src:c,type:TOKS.clb, tokstart:i};
				toks.push(lastt);
				continue;;
			}
			case '0':
			case '1':
			case '2':
			case '3':
			case '4':
			case '5':
			case '6':
			case '7':
			case '8':
			case '9':
			case '.': {
				if (lastt==undefined ||  !tok_is_num(lastt)){
					if (lastt && lastt.type==TOKS.clb) {
						return {msg:'unexpected number start past ")"',errpos:i} satisfies TokenizeError ;
					}
					lastt=({src:c,type:TOKS.num,tokstart:i, got_decp:c=='.',got_lws:false,val:0} satisfies numtok_t) as numtok_t; 
					toks.push(lastt);
					continue;
				}
				if (c=='.') {
					if  (lastt.got_decp) {
						return {msg:'unexpected  second "."',errpos:i} satisfies TokenizeError ;
					}
					lastt.got_decp=true;
				}
				if (lastt.got_lws) {
					return {msg:'unexpected  number start',errpos:i} satisfies TokenizeError ;
				}
				lastt.src+=c;
				continue;
			}

			default: {
				return {msg:'iligal charecter "'+c+'"',errpos:i} satisfies TokenizeError ;
			}
		}
	}
	if (toks.length==0){
		return {msg:"empty expr?",errpos:0} satisfies TokenizeError;
	}
	return toks;
}

function err2str(exp:string,e:TokenizeError){
	let trimmed_exp=exp.trimStart();
	let spaces=e.errpos-(exp.length-trimmed_exp.length);
	let space='';
	while (spaces--) space+=' ';
	let res=trimmed_exp+'\n'+space+'^\n'+e.msg;

	return res;

}
function tok2str(t:tok_t) {
	return '['+TOKS[t.type]+(t.type==TOKS.num?':'+t.src:'')+']';
}



/** Shunting yard algorithm plus final reverse
* -----------------------
* @param infix_tokens: tokens obtained from tokenize_infix ...
* Undefined behavior if collection is not formatted correctly.
*
* The output of this function returns new array containig refferences to infix_tokens elements,
* but reordered in prefix notation for easy call tree generation
*/
function infix_to_prefix(infix_tokens: Array<tok_t>) : Array<tok_t>|TokenizeError {

	let output = new Array<tok_t>();
	let op_stack =new Array<tok_t>();

token_loop:
	for (let token of infix_tokens) {
		if (tok_is_num(token) ) {
			if (token.src==='') return  {msg:"number is empt?",errpos:token.tokstart} satisfies TokenizeError;
			token.val=parseFloat(token.src);
			if (!isFinite(token.val) || token.val!=Number(token.src)){
				return  {msg:"Ivalid number literal",errpos:token.tokstart} satisfies TokenizeError;
			}
			output.push(token);
			continue;
		}
		switch (token.type){
			case TOKS.opb:{
				op_stack.push(token);
				continue;
			}
			case TOKS.clb:{
				let lastop=op_stack.pop();
				while (lastop) {
					if (lastop.type==TOKS.opb) continue token_loop;
				
					output.push(lastop);
					lastop=op_stack.pop(); //next
				}
				return  {msg:"Unbalanced ')'",errpos:token.tokstart} satisfies TokenizeError;
			}
			default :{
				let p1=PREC[token.type] as number;
				let top=op_stack[op_stack.length-1];
				while (top) {
					let p2=PREC[top.type] as number;
					if (p2 > p1) {
						output.push(token);
						op_stack.pop() 
					} else if (p2 == p1 && token.type==TOKS.pow){
						output.push(token);
						op_stack.pop() 
					} else {
						 break 
					};
					top=op_stack[op_stack.length-1];//next
				}
				op_stack.push(token);
			}
		}

	}

	// pop from the head of the operator stack
	return output.concat(op_stack.reverse()).reverse();

}

function generateP (i:number,prefix_tokens:Array<tok_t>,lvl:string):[string,number]{
	let tok=prefix_tokens[i];
	if (!tok) throw new Error("Need more tokens!");
	if (tok_is_num(tok)){
		return[lvl+tok.val,i+1];
	}
	return generateF(i,prefix_tokens,lvl);

}

function generateF (i:number,prefix_tokens:Array<tok_t>,lvl:string):[string,number]{
	let tok=prefix_tokens[i];
	if (!tok) throw new Error("Need more tokens!");

	let res=lvl+TOKS[tok.type].toUpperCase()+'(\n';
	let nextlvl=lvl+'  ';
	let [p2,nexti]=generateP(i+1,prefix_tokens,nextlvl);	
	let [p1,endi]=generateP(nexti,prefix_tokens,nextlvl);
	res+=p1+',\n'+p2+'\n'+lvl+')';
	return[res,endi];
}

function generate(prefix_tokens:Array<tok_t>):string{
	let  [code,]= generateF(0,prefix_tokens,'');
	return code;
}




let exp=process.argv.slice(2).join(' ');
if (exp!='') {
	console.log("exp from params: ",exp);	
} else {
	exp='-1+(-2 +-5*+8.6)-3';
	console.log("default exp: ",exp);	
}

let infix_tokens=tokenize_infix(exp);
if (!Array.isArray(infix_tokens)){
	console.log("error at pos %s:\n%s",infix_tokens.errpos,err2str(exp,infix_tokens));
	process.exit(-1);
}
console.log("tokenize:",infix_tokens.map(tok2str).join(' '));
let prefix_tokens=infix_to_prefix(infix_tokens);
if (!Array.isArray(prefix_tokens)){
	console.log("error at pos %s:\n%s",prefix_tokens.errpos,err2str(exp,prefix_tokens));
	process.exit(-1);
}

console.log("Preffix :",prefix_tokens.map(tok2str).join(' '));
console.log("=== Calls ===\n",generate(prefix_tokens));
