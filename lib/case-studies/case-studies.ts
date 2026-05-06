export type Product =
	| "Titan 250"
	| "Titan 130"
	| "Mars 100"
	| "Mars 90"
	| "Taurus 70"
	| "Taurus 60"
	| "Mercury 50"
	| "Centaur 50"
	| "Centaur 40"
	| "Saturn 20";

export interface CaseStudy {
	name: string;
	url: string;
	description?: string;
	summary?: string;
	featured?: boolean;
	imageUrl?: string;
	thumbnailImageUrl?: string;
	logoImageUrl?: string;
	pdfUrl?: string;
	sourceUrl?: string;
}

export type Region =
	| "Africa"
	| "Asia"
	| "Europe"
	| "Latin America"
	| "Middle East"
	| "North America";


export type ProductCaseStudies = Record<Product, CaseStudy[]>;

export const caseStudiesByProduct: ProductCaseStudies = {
	"Titan 250": [
		{
			name: "CMPC Tissue",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20171020-53899-10116",
		},
		{
			name: "Eight Flags Energy",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20161115-63472-27700",
		},
		{
			name: "Manisa OIZ",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/C10864620",
		},
		{
			name: "Pulp and Paper Industry, AIE IDAE Sant Joan",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20160730-06862-36005",
		},
		{
			name: "Sahacogen Public Company Limited",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190813-74e06-6a11f",
		},
		{
			name: "SIBA Energy Corporation",
			url: "https://www.solarturbines.com/en_US/solutions/case-studies/siba-energy-corporation.html",
		},
		{
			name: "Dept. of Energy - Eight Flags Energy",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-53628",
		},
	],
	"Titan 130": [
		{
			name: "Aqua Power",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200430-eaf79-74058",
		},
		{
			name: "Cornell University",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/C10550265",
		},
		{
			name: "City and Borough of Sitka",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150930-35537-04122",
		},
		{
			name: "Exxon Neftegaz Ltd.",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20180504-48485-32954",
		},
		{
			name: "Genser Energy",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190619-35997-f35c8",
		},
		{
			name: "National Oil Company",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150930-35537-44540",
		},
		{
			name: "New-Indy Containerboard",
			url: "https://www.solarturbines.com/en_US/solutions/case-studies/new-Ind-containerboard.html",
		},
		{
			name: "Ningbo Hua Tai",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20230209-baf92-b5b7c",
		},
		{
			name: "North Carolina Municipal Power Agency",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20171204-57961-48305",
		},
		{
			name: "Pan American Energy SL Sucursal Argentina",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200730-3df91-91224",
		},
		{
			name: "Residue Gas Compression Cryogenic Plants",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200402-fb48a-7dc34",
		},
		{
			name: "SIBA Energy Corporation",
			url: "https://www.solarturbines.com/en_US/solutions/case-studies/siba-energy-corporation.html",
		},
		{
			name: "Single Tenant; Four Buildings, 124 MW IT",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20240528-8aba9-1c55d",
		},
		{
			name: "State Oil Company",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150930-35537-33241",
		},
		{
			name: "Total Petrochemicals Feluy",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20171114-49441-10003",
		},
		{
			name: "University of California San Diego",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-53967",
		},
		{
			name: "University of Cincinnati",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-27254",
		},
		{
			name: "Williams",
			url: "https://www.solarturbines.com/en_US/solutions/case-studies/process-vent-recompression.html",
		},
		{
			name: "Dept. of Energy - Ford Motor Company",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20220621-9763a-211d4",
		},
		{
			name: "Dept. of Energy - HP Hood LLC",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20230220-0beb4-6ca79",
		},
		{
			name: "Dept. of Energy - Milliken Textiles",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20230706-65b96-7b18c",
		},
		{
			name: "Dept. of Energy - Shaw Industries",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190726-6a348-4dc4a",
		},
		{
			name: "Dept. of Energy - Tesoro",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20181113-56713-32277",
		},
		{
			name: "Dept. of Energy - University of Michigan",
			url: "https://www.solarturbines.com/en_US/solutions/case-studies/dept--of-energy---university-of-michigan.html",
		},
	],
	"Mars 100": [
		{
			name: "Cargill, B.V. Netherlands",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20160815-78012-55138",
		},
		{
			name: "Macon Municipal Energy Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-16879",
		},
		{
			name: "Plant Renovation, Societe de Cogeneration Picardie Socopic",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20160730-07691-06183",
		},
		{
			name: "Pulp and Paper Industry, Arctic Paper Kostrzyn",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20160730-07691-34821",
		},
		{
			name: "Remote Gas Processing Plant Arc Resources, Ltd.",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20180511-62048-39722",
		},
		{
			name: "Veolia Proprete",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20171114-43899-23404",
		},
		{
			name: "Dept. of Energy - POET Biorefining & City of Macon, Missouri",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-27410",
		},
		{
			name: "Dept. of Energy - Trailblazer Pipeline",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-26517",
		},
		{
			name: "Dept. of Energy - University of Massachusetts",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-64057",
		},
	],
	"Mars 90": [
		{
			name: "Ancona Storage Facility",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20251120-10669-98171",
		},
	],
	"Taurus 70": [
		{
			name: "Cartiera Pirinoli",
			url: "https://www.solarturbines.com/en_US/solutions/case-studies/cartiera-pirinoli.html",
		},
		{
			name: "DCP Midstream",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190318-44222-46171",
		},
		{
			name: "Fedrigoni Paper Mill",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20210723-95eeb-9337a",
		},
		{
			name: "Foxwoods Resort Casino",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-41408",
		},
		{
			name: "Harvard University",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20170925-51974-50666",
		},
		{
			name: "Kastamonu Entegre",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20170314-47355-20842",
		},
		{
			name: "Kerry Group",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200220-5c4f0-4276b",
		},
	],
	"Taurus 60": [
		{
			name: "Lucart Group Tissue Industry",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20161011-63153-42261",
		},
		{
			name: "Penn State Health Milton S. Hershey Medical Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200430-25202-9b0d5",
		},
		{
			name: "Queen's University",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20180801-65342-07770",
		},
		{
			name: "Sofidel America Corporation",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200203-69a6a-c34ed",
		},
		{
			name: "Swiss Krono Group",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20170314-47557-14189",
		},
		{
			name: "Tissue Industry - Hayat Group",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20170118-59265-45239",
		},
		{
			name: "University of Illinois Hospital",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150709-56914-13451",
		},
		{
			name: "Dept. of Energy - Aberdeen Proving Ground",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190916-5defb-64566",
		},
		{
			name: "Dept. of Energy - Arizona State University",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200826-e3171-4d007",
		},
		{
			name: "Dept. of Energy - Capitol Power Plant",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190726-025c3-ab8bc",
		},
		{
			name: "Dept. of Energy - Caterpillar Aurora",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-14221",
		},
		{
			name: "Dept. of Energy - Eastern Michigan University",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200826-1f889-a9fd6",
		},
		{
			name: "Dept. of Energy - Hershey Medical Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200826-1ff00-c8fa9",
		},
		{
			name: "Dept. of Energy - Sofidel",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20210921-ed98b-1f984",
		},
		{
			name: "Dept. of Energy - Solvay Specialty Polymers",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-07674",
		},
		{
			name: "Dept. of Energy - Toray Plastics America",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-53474",
		},
		{
			name: "Dept. of Energy - University of Illinois at Chicago West Campus",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-58130",
		},
		{
			name: "Dept. of Energy - University of Oregon",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190726-b19d9-35ecb",
		},
		{
			name: "Dept. of Energy - University of Utah",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190726-a6ceb-24620",
		},
		{
			name: "Dept. of Energy - Vanderbilt University",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20230220-7710f-b6411",
		},
		{
			name: "Adkins Energy",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20220517-0b490-8c35f",
		},
		{
			name: "Bay View Wastewater Treatment Plant",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-42476",
		},
		{
			name: "Biogen Idec",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-17145",
		},
		{
			name: "Charlotte Motor Speedway Landfill",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150728-56051-34317",
		},
	],
	"Mercury 50": [
		{
			name: "Coke Oven Gas",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20160211-68438-36713",
		},
		{
			name: "Georgia-Pacific Wood Products",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200720-a34bb-b9f19",
		},
		{
			name: "Gold Art Ceramica",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200219-7f559-460e1",
		},
		{
			name: "Kastamonu Entegre",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20170314-47355-20842",
		},
		{
			name: "Majnoon Oil Field",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150930-35537-12973",
		},
		{
			name: "Montefiore Medical Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-08015",
		},
		{
			name: "Oil and Natural Gas Corporation Ltd. India",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20180504-51443-10969",
		},
		{
			name: "Olinda Alpha Landfill",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150728-51441-17207",
		},
		{
			name: "Pioneers Power Limited",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20171114-50751-16553",
		},
		{
			name: "San Diego State University",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20150709-56914-12241",
		},
		{
			name: "Power for Shale Gas Plant Commissioning",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150930-35537-58358",
		},
		{
			name: "Swiss Krono Group",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20170314-47557-14189",
		},
		{
			name: "York University",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20180801-65342-60677",
		},
		{
			name: "Dept. of Energy - Adkins Energy LLC",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-19176",
		},
		{
			name: "Dept. of Energy - Brigham Young University",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200228-442f7-38c66",
		},
		{
			name: "Dept. of Energy - Bristol-Myers Squibb",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-34911",
		},
		{
			name: "Dept. of Energy - Bucknell University",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-38647",
		},
		{
			name: "Dept. of Energy - Ergon, Inc.",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-62375",
		},
		{
			name: "Dept. of Energy - Erving Industries",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190726-c83f1-12ef1",
		},
		{
			name: "Dept. of Energy - Evonik Stockhausen",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-42533",
		},
		{
			name: "Dept. of Energy - Kennecott Utah Copper Refinery",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-47010",
		},
		{
			name: "Dept. of Energy - NASA's Lyndon B. Johnson Space Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190726-5db8b-01af9",
		},
		{
			name: "Dept. of Energy - North Carolina State University",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-59215",
		},
		{
			name: "Dept. of Energy - Pfizer - Andover",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-52311",
		},
		{
			name: "Dept. of Energy - Rice University",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20210921-bf441-824d0",
		},
		{
			name: "Dept. of Energy - Saint Mary's Hospital",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-31796",
		},
		{
			name: "Dept. of Energy - University of Arkansas",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200826-cccd6-9c669",
		},
		{
			name: "Dept. of Energy - University of Texas Medical Branch",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190726-4e86a-a372e",
		},
		{
			name: "Dept. of Energy - Village Creek Water Reclamation Facility",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200826-71cde-e12ca",
		},
		{
			name: "ESC - Loyola University Medical Center",
			url: "https://www.solarturbines.com/en_US/solutions/case-studies/esc-ulh.html",
		},
		{
			name: "Dell Children's Medical Center of Central Texas",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20150707-37195-44647",
		},
		{
			name: "PEI Power Corporation",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/C10550261",
		},
		{
			name: "Veterans Administration Hospital",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-61295",
		},
		{
			name: "Dept. of Energy - Albany Medical Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200826-7de2d-0a89b",
		},
		{
			name: "Dept. of Energy - D.C. Water Blue Plains AWTP",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20230220-fa62a-3d8e4",
		},
		{
			name: "Dept. of Energy - Dell Children's Medical Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200803-6db86-5a23d",
		},
		{
			name: "Dept. of Energy - East Bay Municipal Utility District WWTP",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-50922",
		},
		{
			name: "Dept. of Energy - MGM Resorts",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190726-767d5-96f9a",
		},
		{
			name: "Dept. of Energy - Morristown Medical Center",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20230706-d2fc0-c56bc",
		},
		{
			name: "Dept. of Energy - Princeton Medical Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200826-f61cf-00c5c",
		},
		{
			name: "Dept. of Energy - San Diego VA Hospital",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-62834",
		},
		{
			name: "Dept. of Energy - Shands Hospital",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-54055",
		},
		{
			name: "Dept. of Energy - St. Joseph's Hospital Health Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200826-d9f68-f11b3",
		},
	],
	"Centaur 50": [
		{
			name: "California Dairies, Inc.",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-28347",
		},
		{
			name: "Captain Morgan Distillery, U.S. Virgin Islands",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20181217-42385-38788",
		},
		{
			name: "Pamesa Do Brazil",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20160122-64637-24451",
		},
		{
			name: "Recordati",
			url: "https://www.solarturbines.com/en_US/solutions/case-studies/Recordati.html",
		},
		{
			name: "Dept. of Energy - Frito-Lay Killingly",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-55759",
		},
		{
			name: "Dept. of Energy - Houston Methodist Hospital",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200826-fb29e-295cd",
		},
		{
			name: "Dept. of Energy - Mississippi Baptist Medical Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-59412",
		},
	],
	"Centaur 40": [
		{
			name: "Ancona Storage Facility",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20251120-10669-98171",
		},
		{
			name: "Arizona LNG LCC",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200716-135b3-e55ca",
		},
		{
			name: "Jesse Brown Veterans Affairs Medical Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-04309",
		},
		{
			name: "Oil and Natural Gas Corporation Ltd. India",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20180504-51443-10969",
		},
		{
			name: "Pastore Power House",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200630-788f6-a9b93",
		},
		{
			name: "Refrigeration Solutions for Small Scale LNG",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20160211-57307-60058",
		},
		{
			name: "Dept. of Energy - Jesse Brown VA Medical Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-08192",
		},
		{
			name: "Dept. of Energy - MCRD Parris Island",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20220621-be016-24379",
		},
		{
			name: "Dept. of Energy - SC Johnson Waxdale Plant",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-16242",
		},
		{
			name: "Dept. of Energy - Smith College Energy Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-03182",
		},
		{
			name: "Ceramic Sichenia",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20170725-66111-45030",
		},
		{
			name: "Dept. of Energy - National Animal Disease Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-59297",
		},
	],
	"Saturn 20": [],
};

export type RegionCaseStudies = Record<Region, CaseStudy[]>;

export const regionCaseStudies: RegionCaseStudies = {
	Africa: [
		{
			name: "Aqua Power",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200430-eaf79-74058?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Genser Energy",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190619-35997-f35c8?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
	],
	Asia: [
		{
			name: "Coke Oven Gas",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20160211-68438-36713?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Fleet Assessment Services - Lifecycle Management",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20240125-d6f8b-750a5?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Ningbo Hua Tai",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20230209-baf92-b5b7c?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Oil and Natural Gas Corporation Ltd. India",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20180504-51443-10969?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Sahacogen Public Company Limited",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190813-74e06-6a11f?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
	],
	Europe: [
		{
			name: "Cargill, B.V. Netherlands",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20160815-78012-55138?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Cartiera Pirinoli",
			url: "https://www.solarturbines.com/en_US/solutions/case-studies/cartiera-pirinoli.html",
		},
		{
			name: "Ceramic Sichenia",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20170725-66111-45030?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Exxon Neftegaz Ltd.",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20180504-48485-32954?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Fedrigoni Paper Mill",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20210723-95eeb-9337a?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Gold Art Ceramica",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200219-7f559-460e1?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Kastamonu Entegre",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20170314-47355-20842?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Kerry Group",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200220-5c4f0-4276b?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Lucart Group Tissue Industry",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20161011-63153-42261?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Manisa OIZ",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/C10864620?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Michelin Reifenwerke KGaA",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20160730-06862-31642?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Plant Renovation, Societe de Cogeneration Picardie Socopic",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20160730-07691-06183?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Pulp and Paper Industry, AIE IDAE Sant Joan",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20160730-06862-36005?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Pulp and Paper Industry, Arctic Paper Kostrzyn",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20160730-07691-34821?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Recordati",
			url: "https://www.solarturbines.com/en_US/solutions/case-studies/Recordati.html",
		},
		{
			name: "Single Tenant; Four Buildings, 124 MW IT",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20240528-8aba9-1c55d?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Swiss Krono Group",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20170314-47557-14189?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Tissue Industry - Hayat Group",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20170118-59265-45239?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Total Petrochemicals Feluy",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20171114-49441-10003?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Veolia Proprete",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20171114-43899-23404?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
	],
	"Latin America": [
		{
			name: "CMPC Tissue",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20171020-53899-10116?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "National Oil Company",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150930-35537-44540?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
	],
	"Middle East": [
		{
			name: "Pamesa Do Brazil",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20160122-64637-24451?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Pan American Energy SL Sucursal Argentina",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200730-3df91-91224?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "State Oil Company",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150930-35537-33241?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "SIBA Energy Corporation",
			url: "https://www.solarturbines.com/en_US/solutions/case-studies/siba-energy-corporation.html",
		},
		{
			name: "Majnoon Oil Field",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150930-35537-12973?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
	],
	"North America": [
		{
			name: "Pioneers Power Limited",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20171114-50751-16553?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Adkins Energy",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20220517-0b490-8c35f?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Ancona Storage Facility",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20251120-10669-98171?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Arizona LNG LCC",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200716-135b3-e55ca?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Bay View Wastewater Treatment Plant",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-42476?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Biogen Idec",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-17145?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "California Dairies, Inc.",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-28347?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Captain Morgan Distillery, U.S. Virgin Islands",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20181217-42385-38788?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Charlotte Motor Speedway Landfill",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150728-56051-34317?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "City and Borough of Sitka",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150930-35537-04122?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Cornell University",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/C10550265?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "DCP Midstream",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190318-44222-46171?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dell Children's Medical Center of Central Texas",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20150707-37195-44647?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Eight Flags Energy",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20161115-63472-27700?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Foxwoods Resort Casino",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-41408?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Georgia-Pacific Wood Products",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200720-a34bb-b9f19?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Harvard University",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20170925-51974-50666?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Jesse Brown Veterans Affairs Medical Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-04309?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Macon Municipal Energy Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-16879?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Montefiore Medical Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-08015?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "New-Indy Containerboard",
			url: "https://www.solarturbines.com/en_US/solutions/case-studies/new-Ind-containerboard.html",
		},
		{
			name: "North Carolina Municipal Power Agency",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20171204-57961-48305?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Olinda Alpha Landfill",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150728-51441-17207?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Pastore Power House",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200630-788f6-a9b93?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "PEI Power Corporation",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/C10550261?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Penn State Health Milton S. Hershey Medical Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200430-25202-9b0d5?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Power for Shale Gas Plant Commissioning",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150930-35537-58358?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Queen's University",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20180801-65342-07770?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Refrigeration Solutions for Small Scale LNG",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20160211-57307-60058?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Remote Gas Processing Plant Arc Resources, Ltd.",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20180511-62048-39722?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Residue Gas Compression Cryogenic Plants",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200402-fb48a-7dc34?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "San Diego State University",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20150709-56914-12241?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Sofidel America Corporation",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200203-69a6a-c34ed?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "University of California San Diego",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-53967?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "University of Cincinnati",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-27254?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "University of Illinois Hospital",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150709-56914-13451?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Veterans Administration Hospital",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-61295?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Williams",
			url: "https://www.solarturbines.com/en_US/solutions/case-studies/process-vent-recompression.html",
		},
		{
			name: "York University",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20180801-65342-60677?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Aberdeen Proving Ground",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190916-5defb-64566?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Adkins Energy LLC",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-19176?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Albany Medical Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200826-7de2d-0a89b?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Arizona State University",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200826-e3171-4d007?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Brigham Young University",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200228-442f7-38c66?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Bristol-Myers Squibb",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-34911?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Bucknell University",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-38647?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Capitol Power Plant",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190726-025c3-ab8bc?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Caterpillar Aurora",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-14221?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - D.C. Water Blue Plains AWTP",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20230220-fa62a-3d8e4?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Dell Children's Medical Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200803-6db86-5a23d?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - East Bay Municipal Utility District WWTP",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-50922?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Eastern Michigan University",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200826-1f889-a9fd6?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Eight Flags Energy",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-53628?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Ergon, Inc.",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-62375?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Erving Industries",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190726-c83f1-12ef1?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Evonik Stockhausen",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-42533?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Ford Motor Company",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20220621-9763a-211d4?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Frito-Lay Killingly",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-55759?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Hershey Medical Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200826-1ff00-c8fa9?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Houston Methodist Hospital",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200826-fb29e-295cd?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - HP Hood LLC",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20230220-0beb4-6ca79?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Jesse Brown VA Medical Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-08192?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Kennecott Utah Copper Refinery",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-47010?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - MCRD Parris Island",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20220621-be016-24379?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - MGM Resorts",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190726-767d5-96f9a?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Milliken Textiles",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20230706-65b96-7b18c?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Mississippi Baptist Medical Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-59412?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Morristown Medical Center",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20230706-d2fc0-c56bc?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - NASA's Lyndon B. Johnson Space Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190726-5db8b-01af9?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - National Animal Disease Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-59297?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - North Carolina State University",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-59215?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Pfizer - Andover",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-52311?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - POET Biorefining & City of Macon, Missouri",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-27410?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Princeton Medical Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200826-f61cf-00c5c?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Rice University",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20210921-bf441-824d0?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Saint Mary's Hospital",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-31796?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - San Diego VA Hospital",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-62834?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - SC Johnson Waxdale Plant",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-16242?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Shands Hospital",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-54055?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Shaw Industries",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190726-6a348-4dc4a?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Smith College Energy Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-03182?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Sofidel",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20210921-ed98b-1f984?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Solvay Specialty Polymers",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-07674?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - St. Joseph's Hospital Health Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200826-d9f68-f11b3?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Tesoro",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20181113-56713-32277?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Toray Plastics America",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-53474?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Trailblazer Pipeline",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-26517?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - University of Arkansas",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200826-cccd6-9c669?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - University of Illinois at Chicago West Campus",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-58130?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - University of Massachusetts",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-64057?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - University of Michigan",
			url: "https://www.solarturbines.com/en_US/solutions/case-studies/dept--of-energy---university-of-michigan.html",
		},
		{
			name: "Dept. of Energy - University of Oregon",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190726-b19d9-35ecb?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - University of Texas Medical Branch",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190726-4e86a-a372e?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - University of Utah",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190726-a6ceb-24620?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Vanderbilt University",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20230220-7710f-b6411?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "Dept. of Energy - Village Creek Water Reclamation Facility",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200826-71cde-e12ca?utm_source=google&utm_medium=organic&utm_campaign=(not%20set)",
		},
		{
			name: "ESC - Loyola University Medical Center",
			url: "https://www.solarturbines.com/en_US/solutions/case-studies/esc-ulh.html",
		},
	],
};

export type Industry =
	| "Ceramic"
	| "Chemicals"
	| "Electric Power"
	| "Food and Beverage"
	| "Oil & Gas"
	| "Government"
	| "Hospital"
	| "Manufacturing"
	| "Microgrid"
	| "Mobile Power"
	| "Pharmaceutical"
	| "Pulp and Paper"
	| "Resorts"
	| "University"
	| "Waste to Energy";

export type IndustryCaseStudies = Record<Industry, CaseStudy[]>;

export const caseStudiesByIndustry: IndustryCaseStudies = {
	Ceramic: [
		{
			name: "Ceramic Sichenia",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20170725-66111-45030",
		},
		{
			name: "Gold Art Ceramica",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200219-7f559-460e1",
		},
		{
			name: "Pamesa Do Brazil",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20160122-64637-24451",
		},
	],
	Chemicals: [
		{
			name: "Adkins Energy",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20220517-0b490-8c35f",
		},
		{
			name: "Ningbo Hua Tai",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20230209-baf92-b5b7c",
		},
		{
			name: "Total Petrochemicals Feluy",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20171114-49441-10003",
		},
		{
			name: "Dept. of Energy - Adkins Energy LLC",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-19176",
		},
		{
			name: "Dept. of Energy - Ergon, Inc.",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-62375",
		},
		{
			name: "Dept. of Energy - Evonik Stockhausen",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-42533",
		},
		{
			name: "Dept. of Energy - POET Biorefining & City of Macon, Missouri",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-27410",
		},
		{
			name: "Dept. of Energy - Solvay Specialty Polymers",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-07674",
		},
		{
			name: "Dept. of Energy - Tesoro",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20181113-56713-32277",
		},
	],
	"Electric Power": [
		{
			name: "Aqua Power",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200430-eaf79-74058",
		},
		{
			name: "City and Borough of Sitka",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150930-35537-04122",
		},
		{
			name: "Eight Flags Energy",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20161115-63472-27700",
		},
		{
			name: "Genser Energy",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190619-35997-f35c8",
		},
		{
			name: "Macon Municipal Energy Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-16879",
		},
		{
			name: "Manisa OIZ",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20160122-62788-47909",
		},
		{
			name: "North Carolina Municipal Power Agency",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20171204-57961-48305",
		},
		{
			name: "Pan American Energy SL Sucursal Argentina",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200730-3df91-91224",
		},
		{
			name: "Pastore Power House",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200630-788f6-a9b93",
		},
		{
			name: "PEI Power Corporation",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20200626-41ee6-8f66c",
		},
		{
			name: "Pioneers Power Limited",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20171114-50751-16553",
		},
		{
			name: "Plant Renovation, Societe de Cogeneration Picardie Socopic",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20160730-07691-06183",
		},
		{
			name: "Sahacogen Public Company Limited",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190813-74e06-6a11f",
		},
		{
			name: "SIBA Energy Corporation",
			url: "https://www.solarturbines.com/en_US/solutions/case-studies/siba-energy-corporation.html",
		},
		{
			name: "Single Tenant; Four Buildings, 124 MW IT",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20240528-8aba9-1c55d",
		},
		{
			name: "Dept. of Energy - Eight Flags Energy",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-53628",
		},
	],
	"Food and Beverage": [
		{
			name: "California Dairies, Inc.",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-28347",
		},
		{
			name: "Captain Morgan Distillery, U.S. Virgin Islands",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20181217-42385-38788",
		},
		{
			name: "Cargill, B.V. Netherlands",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20160815-78012-55138",
		},
	],
	"Oil & Gas": [
		{
			name: "Kerry Group",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200220-5c4f0-4276b",
		},
		{
			name: "Dept. of Energy - Frito-Lay Killingly",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-55759",
		},
		{
			name: "Dept. of Energy - HP Hood LLC",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20230220-0beb4-6ca79",
		},
		{
			name: "Ancona Storage Facility",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20251120-10669-98171",
		},
		{
			name: "Arizona LNG LCC",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200716-135b3-e55ca",
		},
		{
			name: "DCP Midstream",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190318-44222-46171",
		},
		{
			name: "Fleet Assessment Services - Lifecycle Management",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20240125-d6f8b-750a5",
		},
		{
			name: "Refrigeration Solutions for Small Scale LNG",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20160211-57307-60058",
		},
		{
			name: "Residue Gas Compression Cryogenic Plants",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200402-fb48a-7dc34",
		},
	],
	Government: [
		{
			name: "Williams",
			url: "https://www.solarturbines.com/en_US/solutions/case-studies/process-vent-recompression.html",
		},
		{
			name: "Dept. of Energy - Trailblazer Pipeline",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-26517",
		},
		{
			name: "Jesse Brown Veterans Affairs Medical Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-04309",
		},
		{
			name: "Veterans Administration Hospital",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-61295",
		},
		{
			name: "Dept. of Energy - Aberdeen Proving Ground",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190916-5defb-64566",
		},
		{
			name: "Dept. of Energy - Capitol Power Plant",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190726-025c3-ab8bc",
		},
		{
			name: "Dept. of Energy - Jesse Brown VA Medical Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-08192",
		},
		{
			name: "Dept. of Energy - NASA's Lyndon B. Johnson Space Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190726-5db8b-01af9",
		},
		{
			name: "Dept. of Energy - National Animal Disease Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-59297",
		},
		{
			name: "Dept. of Energy - San Diego VA Hospital",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-62834",
		},
	],
	Hospital: [
		{
			name: "Dell Children's Medical Center of Central Texas",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20150707-37195-44647",
		},
		{
			name: "Montefiore Medical Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-08015",
		},
		{
			name: "Penn State Health Milton S. Hershey Medical Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200430-25202-9b0d5",
		},
	],
	Manufacturing: [
		{
			name: "University of Illinois Hospital",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150709-56914-13451",
		},
		{
			name: "Dept. of Energy - Albany Medical Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200826-7de2d-0a89b",
		},
		{
			name: "Dept. of Energy - Dell Children's Medical Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200803-6db86-5a23d",
		},
		{
			name: "Dept. of Energy - Hershey Medical Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200826-1ff00-c8fa9",
		},
		{
			name: "Dept. of Energy - Houston Methodist Hospital",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200826-fb29e-295cd",
		},
		{
			name: "Dept. of Energy - Mississippi Baptist Medical Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-59412",
		},
		{
			name: "Dept. of Energy - Morristown Medical Center",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20230706-d2fc0-c56bc",
		},
		{
			name: "Dept. of Energy - Princeton Medical Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200826-f61cf-00c5c",
		},
		{
			name: "Dept. of Energy - Shands Hospital",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-54055",
		},
	],
	Microgrid: [
		{
			name: "Dept. of Energy - Saint Mary's Hospital",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-31796",
		},
		{
			name: "Dept. of Energy - St. Joseph's Hospital Health Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200826-d9f68-f11b3",
		},
		{
			name: "Dept. of Energy - University of Texas Medical Branch",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190726-4e86a-a372e",
		},
		{
			name: "Kastamonu Entegre",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20170314-47355-20842",
		},
		{
			name: "Michelin Reifenwerke KGaA",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20160730-06862-31642",
		},
		{
			name: "Swiss Krono Group",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20170314-47557-14189",
		},
		{
			name: "Dept. of Energy - Caterpillar Aurora",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-14221",
		},
		{
			name: "Dept. of Energy - Ford Motor Company",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20220621-9763a-211d4",
		},
		{
			name: "Dept. of Energy - Kennecott Utah Copper Refinery",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-47010",
		},
		{
			name: "Dept. of Energy - Milliken Textiles",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20230706-65b96-7b18c",
		},
		{
			name: "Dept. of Energy - SC Johnson Waxdale Plant",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-16242",
		},
		{
			name: "Dept. of Energy - Shaw Industries",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190726-6a348-4dc4a",
		},
		{
			name: "Dept. of Energy - Toray Plastics America",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-53474",
		},
		{
			name: "Exxon Neftegaz Ltd.",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20180504-48485-32954",
		},
		{
			name: "Oil and Natural Gas Corporation Ltd. India",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20180504-51443-10969",
		},
		{
			name: "Remote Gas Processing Plant Arc Resources, Ltd.",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20180511-62048-39722",
		},
		{
			name: "Dept. of Energy - MCRD Parris Island",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20220621-be016-24379",
		},
	],
	"Mobile Power": [
		{
			name: "Power for Shale Gas Plant Commissioning",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150930-35537-58358",
		},
		{
			name: "Majnoon Oil Field",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150930-35537-12973",
		},
		{
			name: "National Oil Company",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150930-35537-44540",
		},
	],
	Pharmaceutical: [
		{
			name: "State Oil Company",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150930-35537-33241",
		},
		{
			name: "Biogen Idec",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-17145",
		},
		{
			name: "Recordati",
			url: "https://www.solarturbines.com/en_US/solutions/case-studies/Recordati.html",
		},
		{
			name: "Dept. of Energy - Bristol-Myers Squibb",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-34911",
		},
		{
			name: "Dept. of Energy - Pfizer - Andover",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-52311",
		},
	],
	"Pulp and Paper": [
		{
			name: "Cartiera Pirinoli",
			url: "https://www.solarturbines.com/en_US/solutions/case-studies/cartiera-pirinoli.html",
		},
		{
			name: "CMPC Tissue",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20171020-53899-10116",
		},
		{
			name: "Fedrigoni Paper Mill",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20210723-95eeb-9337a",
		},
		{
			name: "Georgia-Pacific Wood Products",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200720-a34bb-b9f19",
		},
		{
			name: "Lucart Group Tissue Industry",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20161011-63153-42261",
		},
		{
			name: "New-Indy Containerboard",
			url: "https://www.solarturbines.com/en_US/solutions/case-studies/new-Ind-containerboard.html",
		},
		{
			name: "Pulp and Paper Industry, AIE IDAE Sant Joan",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20160730-06862-36005",
		},
		{
			name: "Pulp and Paper Industry, Arctic Paper Kostrzyn",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20160730-07691-34821",
		},
		{
			name: "Sofidel America Corporation",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200203-69a6a-c34ed",
		},
		{
			name: "Tissue Industry - Hayat Group",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20170118-59265-45239",
		},
		{
			name: "Dept. of Energy - Erving Industries",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190726-c83f1-12ef1",
		},
		{
			name: "Dept. of Energy - Sofidel",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20210921-ed98b-1f984",
		},
	],
	Resorts: [
		{
			name: "Foxwoods Resort Casino",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-41408",
		},
		{
			name: "Dept. of Energy - MGM Resorts",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190726-767d5-96f9a",
		},
		{
			name: "Cornell University",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200623-6f3bd-cf63c",
		},
	],
	University: [
		{
			name: "Harvard University",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20170925-51974-50666",
		},
		{
			name: "Queen's University",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20180801-65342-07770",
		},
		{
			name: "San Diego State University",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20150709-56914-12241",
		},
		{
			name: "University of California San Diego",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-53967",
		},
		{
			name: "University of Cincinnati",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-27254",
		},
		{
			name: "York University",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20180801-65342-60677",
		},
		{
			name: "Dept. of Energy - Arizona State University",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200826-e3171-4d007",
		},
		{
			name: "Dept. of Energy - Brigham Young University",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200228-442f7-38c66",
		},
		{
			name: "Dept. of Energy - Bucknell University",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-38647",
		},
	],
	"Waste to Energy": [
		{
			name: "Dept. of Energy - Eastern Michigan University",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200826-1f889-a9fd6",
		},
		{
			name: "Dept. of Energy - North Carolina State University",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-59215",
		},
		{
			name: "Dept. of Energy - Rice University",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20210921-bf441-824d0",
		},
		{
			name: "Dept. of Energy - Smith College Energy Center",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-03182",
		},
		{
			name: "Dept. of Energy - University of Arkansas",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200826-cccd6-9c669",
		},
		{
			name: "Dept. of Energy - University of Illinois at Chicago West Campus",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-58130",
		},
		{
			name: "Dept. of Energy - University of Massachusetts",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-64057",
		},
		{
			name: "Dept. of Energy - University of Michigan",
			url: "https://www.solarturbines.com/en_US/solutions/case-studies/dept--of-energy---university-of-michigan.html",
		},
		{
			name: "Dept. of Energy - University of Oregon",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190726-b19d9-35ecb",
		},
		{
			name: "Dept. of Energy - University of Utah",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190726-a6ceb-24620",
		},
		{
			name: "Dept. of Energy - Vanderbilt University",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20230220-7710f-b6411",
		},
		{
			name: "ESC - Loyola University Medical Center",
			url: "https://www.solarturbines.com/en_US/solutions/case-studies/esc-ulh.html",
		},
		{
			name: "Bay View Wastewater Treatment Plant",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20150703-52095-42476",
		},
		{
			name: "Charlotte Motor Speedway Landfill",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150728-56051-34317",
		},
		{
			name: "Coke Oven Gas",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20160211-68438-36713",
		},
		{
			name: "Olinda Alpha Landfill",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20150728-51441-17207",
		},
		{
			name: "PEI Power Corporation",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/C10550261",
		},
		{
			name: "Veolia Proprete",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20171114-43899-23404",
		},
		{
			name: "Dept. of Energy - D.C. Water Blue Plains AWTP",
			url: "https://s7d2.scene7.com/is/content/Caterpillar/CM20230220-fa62a-3d8e4",
		},
		{
			name: "Dept. of Energy - East Bay Municipal Utility District WWTP",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20190108-44231-50922",
		},
		{
			name: "Dept. of Energy - Village Creek Water Reclamation Facility",
			url: "http://s7d2.scene7.com/is/content/Caterpillar/CM20200826-71cde-e12ca",
		},
	],
};

export interface CaseStudyRecord extends CaseStudy {
	id: string;
	products: Product[];
	regions: Region[];
	industries: Industry[];
}

function slugifyCaseStudy(value: string) {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function createCaseStudyKey(caseStudy: CaseStudy) {
	return `${caseStudy.name}::${caseStudy.url}`;
}

function normalizeCaseStudyUrl(url: string) {
	return url.startsWith("http://") ? url.replace("http://", "https://") : url;
}

function createCaseStudyId(caseStudy: CaseStudy) {
	const normalizedUrl = normalizeCaseStudyUrl(caseStudy.url);
	const urlSlug = slugifyCaseStudy(normalizedUrl).slice(-18);
	return `${slugifyCaseStudy(caseStudy.name)}-${urlSlug}`;
}

function buildCaseStudyRecords() {
	const records = new Map<string, CaseStudyRecord>();

	const ensureRecord = (caseStudy: CaseStudy) => {
		const key = createCaseStudyKey(caseStudy);
		const existing = records.get(key);
		if (existing) {
			existing.description ??= caseStudy.description;
			existing.summary ??= caseStudy.summary;
			existing.featured = existing.featured || Boolean(caseStudy.featured);
			existing.imageUrl ??= caseStudy.imageUrl;
			existing.thumbnailImageUrl ??= caseStudy.thumbnailImageUrl ?? caseStudy.imageUrl;
			existing.logoImageUrl ??= caseStudy.logoImageUrl;
			existing.pdfUrl ??= caseStudy.pdfUrl ? normalizeCaseStudyUrl(caseStudy.pdfUrl) : undefined;
			existing.sourceUrl ??= caseStudy.sourceUrl ? normalizeCaseStudyUrl(caseStudy.sourceUrl) : normalizeCaseStudyUrl(caseStudy.url);
			existing.url = existing.sourceUrl ?? existing.url;
			return existing;
		}

		const record: CaseStudyRecord = {
			...caseStudy,
			id: createCaseStudyId(caseStudy),
			url: normalizeCaseStudyUrl(caseStudy.sourceUrl ?? caseStudy.url),
			summary: caseStudy.summary ?? caseStudy.description,
			featured: Boolean(caseStudy.featured),
			thumbnailImageUrl: caseStudy.thumbnailImageUrl ?? caseStudy.imageUrl,
			pdfUrl: caseStudy.pdfUrl ? normalizeCaseStudyUrl(caseStudy.pdfUrl) : undefined,
			sourceUrl: normalizeCaseStudyUrl(caseStudy.sourceUrl ?? caseStudy.url),
			products: [],
			regions: [],
			industries: [],
		};

		records.set(key, record);
		return record;
	};

	for (const [product, caseStudies] of Object.entries(caseStudiesByProduct) as Array<[Product, CaseStudy[]]>) {
		for (const caseStudy of caseStudies) {
			const record = ensureRecord(caseStudy);
			if (!record.products.includes(product)) {
				record.products.push(product);
			}
		}
	}

	for (const [region, caseStudies] of Object.entries(regionCaseStudies) as Array<[Region, CaseStudy[]]>) {
		for (const caseStudy of caseStudies) {
			const record = ensureRecord(caseStudy);
			if (!record.regions.includes(region)) {
				record.regions.push(region);
			}
		}
	}

	for (const [industry, caseStudies] of Object.entries(caseStudiesByIndustry) as Array<[Industry, CaseStudy[]]>) {
		for (const caseStudy of caseStudies) {
			const record = ensureRecord(caseStudy);
			if (!record.industries.includes(industry)) {
				record.industries.push(industry);
			}
		}
	}

	return Array.from(records.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function buildFeaturedCaseStudies(records: CaseStudyRecord[]) {
	const explicitFeatured = records.filter((record) => record.featured);
	if (explicitFeatured.length > 0) {
		return explicitFeatured.sort((left, right) => left.name.localeCompare(right.name));
	}

	const featured: CaseStudyRecord[] = [];
	const usedIds = new Set<string>();

	for (const product of Object.keys(caseStudiesByProduct) as Product[]) {
		const match = records.find((record) => record.products.includes(product) && !usedIds.has(record.id));
		if (!match) {
			continue;
		}

		featured.push(match);
		usedIds.add(match.id);

		if (featured.length >= 6) {
			break;
		}
	}

	return featured;
}

export const caseStudyRecords = buildCaseStudyRecords();
export const featuredCaseStudies = buildFeaturedCaseStudies(caseStudyRecords);
